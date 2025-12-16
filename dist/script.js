// Constants
const DOM_ELEMENTS = {
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  itemName: document.getElementById("itemName"),
  itemId: document.getElementById("itemId"),
  applyBtn: document.getElementById("applyFilters"),
  resetBtn: document.getElementById("resetFilters"),
  toggleTableBtn: document.getElementById("toggleTable"),
  dataTable: document.getElementById("dataTable"),
  tableBody: document.getElementById("tableBody"),
  chartStatus: document.getElementById("chartStatus"),
  chartTabs: document.querySelectorAll(".tab"),
  priceChart: document.getElementById("priceChart"),
  candlestickChart: document.getElementById("candlestickChart"),
  timeframeBtns: document.querySelectorAll(".timeframe-btn"),
  timePickerGroup: document.getElementById("timePickerGroup"),
  prevDayBtn: document.getElementById("prevDay"),
  nextDayBtn: document.getElementById("nextDay"),
  calculatorToggle: document.getElementById("calculatorToggle"),
  calculatorSidebar: document.getElementById("calculatorSidebar"),
  autoRefreshToggle: document.getElementById("autoRefreshToggle"),
};

let refreshInterval = null;
const REFRESH_INTERVAL_MS = 60000; // 1 minute

// Determine endpoint based on timeframe
const API_CONFIG = {
  BASE_URL:
    "https://script.google.com/macros/s/AKfycbxP7bkclfZq_rrNClyrn5bYQuB7kVNVU0edCIyQHhFW7TuTu9Gg4-kKUaJtuRz0ziA8_Q/exec", // 👈 PUT YOUR GAS URL HERE
  REQUEST_CONFIG: { method: "GET" },
  ENDPOINTS: {
    ITEM_MARKET: "item_market",
    ITEM_MARKET_5M: "item_market_5m",
    ITEM_MARKET_15M: "item_market_15m",
    ITEM_MARKET_30M: "item_market_30m",
    ITEM_MARKET_1H: "item_market_1h",
    ITEM_MARKET_DAY: "item_market_day",
    ITEM_MARKET_DAY_TRADE: "item_market_day_trade",
    UNIQUE_ITEM_MARKET: "unique_item_market_name",
    BEST_ITEMS_TO_BUY: "best_items_to_buy",
  },
};

// Chart configuration
const CHART_CONFIG = {
  priceChart: null,
  candlestickChart: null,
  currentChartType: "line",
  chartData: [],
  currentTimeframe: "15m",
  itemNames: [],
  autoCalculating: true,
};

// Set default dates to today
const today = new Date();
const formattedToday = today.toISOString().split("T")[0];
DOM_ELEMENTS.startDate.value = formattedToday;
DOM_ELEMENTS.endDate.value = formattedToday;

// Initialize the dashboard
document.addEventListener("DOMContentLoaded", () => {
  initAutocomplete();
  fetchData();
  initProfitCalculator();
  setupEventListeners();
});

/**
 * Initialize profit calculator
 */
function initProfitCalculator() {
  const calculatorElements = {
    buyPrice: document.getElementById("buyPrice"),
    transactionFee: document.getElementById("transactionFee"),
    targetPrice: document.getElementById("targetPrice"),
    feeAmount: document.getElementById("feeAmount"),
    totalCost: document.getElementById("totalCost"),
    profitAmount: document.getElementById("profitAmount"),
    profitPercentage: document.getElementById("profitPercentage"),
    resetButton: document.getElementById("resetButton"),
  };

  let autoCalculating = true;

  calculatorElements.resetButton.addEventListener("click", () => {
    calculatorElements.buyPrice.value = "";
    calculatorElements.targetPrice.value = "";
    calculatorElements.transactionFee.value = 5;
    calculateResults();
  });

  // Initialize with default values
  updateBreakEvenPrice();

  // Add event listeners
  calculatorElements.buyPrice.addEventListener("input", () => {
    if (autoCalculating) updateBreakEvenPrice();
    calculateResults();
  });

  calculatorElements.transactionFee.addEventListener("input", () => {
    if (autoCalculating) updateBreakEvenPrice();
    calculateResults();
  });

  calculatorElements.targetPrice.addEventListener("input", () => {
    autoCalculating = false;
    calculateResults();
  });

  function updateBreakEvenPrice() {
    const buyPrice = parseFloat(calculatorElements.buyPrice.value) || 0;
    const transactionFeePercent =
      parseFloat(calculatorElements.transactionFee.value) || 0;
    const breakEvenPrice =
      transactionFeePercent < 100
        ? buyPrice / (1 - transactionFeePercent / 100)
        : 0;
    calculatorElements.targetPrice.value = breakEvenPrice.toFixed(2);
  }

  function calculateResults() {
    const buyPrice = parseFloat(calculatorElements.buyPrice.value) || 0;
    const transactionFeePercent =
      parseFloat(calculatorElements.transactionFee.value) || 0;
    const targetPrice = parseFloat(calculatorElements.targetPrice.value) || 0;

    const feeAmount = targetPrice * (transactionFeePercent / 100);
    const totalCost = buyPrice + feeAmount;
    const profitAmount = targetPrice - totalCost;
    const profitPercentage =
      totalCost > 0 ? (profitAmount / totalCost) * 100 : 0;

    // Update the display
    calculatorElements.feeAmount.textContent = `₱${feeAmount.toFixed(2)}`;
    calculatorElements.totalCost.textContent = `₱${totalCost.toFixed(2)}`;
    calculatorElements.profitAmount.textContent = `₱${profitAmount.toFixed(2)}`;
    calculatorElements.profitPercentage.textContent = `${profitPercentage.toFixed(
      2
    )}%`;

    // Update colors based on profit
    const profitClass =
      profitAmount > 0 ? "profit" : profitAmount < 0 ? "loss" : "break-even";
    calculatorElements.profitAmount.className = `result-value ${profitClass}`;
    calculatorElements.profitPercentage.className = `result-value ${profitClass}`;
  }

  window.calculateResultsGlobal = calculateResults;
  window.updateBreakEvenPriceGlobal = updateBreakEvenPrice;
}

/**
 * Initialize autocomplete for item name
 */
async function initAutocomplete() {
  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}?endpoint=${API_CONFIG.ENDPOINTS.UNIQUE_ITEM_MARKET}?select=name`,
      API_CONFIG.REQUEST_CONFIG
    );
    const data = await response.json();
    const uniqueItemName = new Set(data.map((e) => e.name));
    CHART_CONFIG.itemNames = [...uniqueItemName];

    let currentFocus;

    DOM_ELEMENTS.itemName.addEventListener("input", function (e) {
      const val = this.value;
      closeAllLists();
      if (!val) return false;
      currentFocus = -1;

      const autocompleteList = document.createElement("DIV");
      autocompleteList.setAttribute("id", `${this.id}-autocomplete-list`);
      autocompleteList.setAttribute("class", "autocomplete-items");
      this.parentNode.appendChild(autocompleteList);

      const matches = CHART_CONFIG.itemNames.filter((item) =>
        item.toLowerCase().includes(val.toLowerCase())
      );

      matches.forEach((item) => {
        const itemElement = document.createElement("DIV");
        itemElement.innerHTML = `<strong>${item.substr(
          0,
          val.length
        )}</strong>${item.substr(val.length)}`;
        itemElement.innerHTML += `<input type='hidden' value='${item}'>`;
        itemElement.addEventListener("click", () => {
          DOM_ELEMENTS.itemName.value = item;
          closeAllLists();
        });
        autocompleteList.appendChild(itemElement);
      });
    });

    DOM_ELEMENTS.itemName.addEventListener("keydown", function (e) {
      const autocompleteItems = document.getElementById(
        `${this.id}-autocomplete-list`
      );
      if (!autocompleteItems) return;

      const items = autocompleteItems.getElementsByTagName("div");

      switch (e.key) {
        case "ArrowDown":
          currentFocus++;
          addActive(items);
          break;
        case "ArrowUp":
          currentFocus--;
          addActive(items);
          break;
        case "Enter":
          e.preventDefault();
          if (currentFocus > -1 && items) {
            items[currentFocus].click();
          }
          break;
      }
    });

    function addActive(items) {
      if (!items) return false;
      removeActive(items);
      if (currentFocus >= items.length) currentFocus = 0;
      if (currentFocus < 0) currentFocus = items.length - 1;
      items[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(items) {
      Array.from(items).forEach((item) =>
        item.classList.remove("autocomplete-active")
      );
    }

    function closeAllLists(elmnt) {
      const autocompleteItems =
        document.getElementsByClassName("autocomplete-items");
      Array.from(autocompleteItems).forEach((item) => {
        if (elmnt !== item && elmnt !== DOM_ELEMENTS.itemName) {
          item.parentNode.removeChild(item);
        }
      });
    }

    document.addEventListener("click", (e) => closeAllLists(e.target));
  } catch (error) {
    console.error("Error initializing autocomplete:", error);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  DOM_ELEMENTS.applyBtn.addEventListener("click", fetchData);
  DOM_ELEMENTS.resetBtn.addEventListener("click", resetFilters);
  DOM_ELEMENTS.toggleTableBtn.addEventListener("click", toggleTable);
  DOM_ELEMENTS.autoRefreshToggle.addEventListener("click", toggleAutoRefresh);

  DOM_ELEMENTS.timeframeBtns.forEach((btn) => {
    btn.addEventListener("click", function () {
      DOM_ELEMENTS.timeframeBtns.forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      CHART_CONFIG.currentTimeframe = this.getAttribute("data-timeframe");

      const showTimePicker = ["1h", "30m", "15m", "5m", "1m"].includes(
        CHART_CONFIG.currentTimeframe
      );
      DOM_ELEMENTS.timePickerGroup.style.display = showTimePicker
        ? "block"
        : "none";
      fetchData();
    });
  });

  DOM_ELEMENTS.chartTabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      DOM_ELEMENTS.chartTabs.forEach((t) => t.classList.remove("active"));
      this.classList.add("active");
      CHART_CONFIG.currentChartType = this.getAttribute("data-chart");

      if (CHART_CONFIG.currentChartType === "candlestick") {
        DOM_ELEMENTS.priceChart.style.display = "none";
        DOM_ELEMENTS.candlestickChart.style.display = "block";
        renderCandlestickChart();
      } else {
        DOM_ELEMENTS.priceChart.style.display = "block";
        DOM_ELEMENTS.candlestickChart.style.display = "none";
        renderChart();
      }
    });
  });

  DOM_ELEMENTS.prevDayBtn.addEventListener("click", () => navigateDays(-1));
  DOM_ELEMENTS.nextDayBtn.addEventListener("click", () => navigateDays(1));

  DOM_ELEMENTS.calculatorToggle.addEventListener("click", function () {
    DOM_ELEMENTS.calculatorSidebar.classList.toggle("visible");
    this.innerHTML = DOM_ELEMENTS.calculatorSidebar.classList.contains(
      "visible"
    )
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-calculator"></i>';
  });
}

/**
 * Fetch data from API
 */
async function fetchData(callback) {
  try {
    const startDate = DOM_ELEMENTS.startDate.value
      ? new Date(DOM_ELEMENTS.startDate.value)
      : new Date();
    let endDate = DOM_ELEMENTS.endDate.value
      ? new Date(DOM_ELEMENTS.endDate.value)
      : new Date();
    const itemName = DOM_ELEMENTS.itemName.value.trim();
    const itemId = DOM_ELEMENTS.itemId.value
      ? parseInt(DOM_ELEMENTS.itemId.value)
      : null;

    if (!itemName && !itemId) return;

    DOM_ELEMENTS.chartStatus.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <div>Loading market data...</div>
      </div>
    `;

    // Handle time selection
    if (CHART_CONFIG.currentTimeframe !== "day") {
      if (DOM_ELEMENTS.startTime.value) {
        const [startHours, startMinutes] = DOM_ELEMENTS.startTime.value
          .split(":")
          .map(Number);
        startDate.setUTCHours(startHours, startMinutes, 0, 0);
      } else {
        startDate.setUTCHours(0, 0, 0, 0);
      }

      if (DOM_ELEMENTS.endTime.value) {
        const [endHours, endMinutes] = DOM_ELEMENTS.endTime.value
          .split(":")
          .map(Number);
        endDate.setUTCHours(endHours, endMinutes, 59, 999);
      } else {
        endDate.setUTCHours(23, 59, 59, 999);
      }
    } else {
      startDate.setUTCHours(0, 0, 0, 0);
      endDate.setUTCHours(23, 59, 59, 999);
    }

    const params = [
      { field: "createddate", operator: "gte", value: startDate.toISOString() },
      { field: "createddate", operator: "lte", value: endDate.toISOString() },
    ];

    if (itemName) {
      params.push({ field: "name", operator: "eq", value: itemName });
    }

    if (itemId) {
      params.push({ field: "item_id", operator: "eq", value: itemId });
    }

    const endpointMap = {
      "1m": API_CONFIG.ENDPOINTS.ITEM_MARKET,
      "5m": API_CONFIG.ENDPOINTS.ITEM_MARKET_5M,
      "15m": API_CONFIG.ENDPOINTS.ITEM_MARKET_15M,
      "30m": API_CONFIG.ENDPOINTS.ITEM_MARKET_30M,
      "1h": API_CONFIG.ENDPOINTS.ITEM_MARKET_1H,
      day: API_CONFIG.ENDPOINTS.ITEM_MARKET_DAY,
    };

    const endpoint =
      endpointMap[CHART_CONFIG.currentTimeframe] ||
      API_CONFIG.ENDPOINTS.ITEM_MARKET_DAY;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30 * 60 * 1000); // 30 mins
    const response = await fetch(
      `${API_CONFIG.BASE_URL}?endpoint=${endpoint}&${urlParamsFormatter(
        params
      )}`,
      {
        ...API_CONFIG.REQUEST_CONFIG,
        signal: controller.signal,
      }
    );

    // Clear timeout once fetch succeeds
    clearTimeout(timeout);

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    CHART_CONFIG.chartData = data;

    if (typeof callback == "function") {
      callback(data);
    }

    if (CHART_CONFIG.chartData.length === 0) {
      renderChart();
      DOM_ELEMENTS.chartStatus.innerHTML = `
        <div class="status">
          <i class="fas fa-info-circle"></i> No data found with current filters. 
          Add an Item to monitor &nbsp;<a target="_blank"  href="https://gvsantiago-tech-dev-ed.my.site.com/tornitems/s/">here</a>
        </div>
      `;
    } else {
      DOM_ELEMENTS.chartStatus.innerHTML = "";
      renderChart();
      populateTable();

      if (CHART_CONFIG.currentChartType === "candlestick") {
        renderCandlestickChart();
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    DOM_ELEMENTS.chartStatus.innerHTML = `
      <div class="status">
        <i class="fas fa-exclamation-triangle"></i> Error loading data: ${error.message}
      </div>
    `;
  }
}

/**
 * Format URL parameters
 */
function urlParamsFormatter(params) {
  return encodeURI(
    params
      .map((param) => `${param.field}=${param.operator}.${param.value}`)
      .join("&")
  );
}

/**
 * Render the chart
 */
function renderChart() {
  if (CHART_CONFIG.priceChart) CHART_CONFIG.priceChart.destroy();
  if (
    CHART_CONFIG.chartData.length === 0 ||
    CHART_CONFIG.currentChartType == "candlestick"
  )
    return (DOM_ELEMENTS.priceChart.style.display = "none");

  DOM_ELEMENTS.priceChart.style.display = "block";

  const ctx = DOM_ELEMENTS.priceChart.getContext("2d");
  CHART_CONFIG.chartData.sort(
    (a, b) => new Date(a.createddate) - new Date(b.createddate)
  );

  const isScatter = CHART_CONFIG.currentChartType === "scatter";
  const isBar = CHART_CONFIG.currentChartType === "bar";
  const isLine = CHART_CONFIG.currentChartType === "line";

  const chartConfig = {
    type: CHART_CONFIG.currentChartType,
    data: {
      labels: isScatter
        ? []
        : CHART_CONFIG.chartData.map((item) => {
            const date = new Date(item.createddate);
            return `${
              date.getUTCMonth() + 1
            }/${date.getUTCDate()} ${date.getUTCHours()}:${date
              .getUTCMinutes()
              .toString()
              .padStart(2, "0")}`;
          }),
      datasets: [
        createDatasetConfig(
          CHART_CONFIG.chartData[0]?.name || "Item",
          "price",
          "rgba(255, 126, 95, 1)"
        ),
        createDatasetConfig(
          CHART_CONFIG.chartData[0]?.name || "Item",
          "average_price",
          "rgba(0, 0, 255, 1)"
        ),
      ],
    },
    options: getChartOptions(),
  };

  CHART_CONFIG.priceChart = new Chart(ctx, chartConfig);
  window.addEventListener("resize", () => {
    if (CHART_CONFIG.priceChart) CHART_CONFIG.priceChart.resize();
  });

  function createDatasetConfig(labelPrefix, valueField, borderColor) {
    return {
      label: `${labelPrefix} ${
        valueField === "price" ? "Price" : "Average Price"
      } ($)`,
      data: isScatter
        ? CHART_CONFIG.chartData.map((item) => ({
            x: new Date(item.createddate),
            y: item[valueField],
            z: item.quantity,
          }))
        : CHART_CONFIG.chartData.map((item) => ({
            x: new Date(item.createddate),
            y: item[valueField],
            z: item.quantity,
          })),
      backgroundColor: isBar
        ? "rgba(255, 126, 95, 0.7)"
        : "rgba(255, 126, 95, 0.2)",
      borderColor,
      borderWidth: isScatter ? 1 : 2,
      pointBackgroundColor: "rgba(255, 255, 255, 1)",
      pointBorderColor: borderColor,
      pointRadius: isScatter ? 5 : 4,
      pointHoverRadius: 6,
      tension: isLine ? 0.1 : 0,
      fill: isLine,
      showLine: !isScatter,
    };
  }

  function getChartOptions() {
    const isMobile = window.innerWidth < 480;
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: {
          labels: {
            color: "#f0f0f0",
            font: {
              size: isMobile ? 10 : 12,
              weight: "bold",
            },
            padding: 20,
          },
        },
        tooltip: {
          backgroundColor: "rgba(30, 30, 50, 0.95)",
          titleColor: "#ff7e5f",
          bodyColor: "#f0f0f0",
          borderColor: "rgba(255, 126, 95, 0.8)",
          borderWidth: 1,
          padding: 12,
          bodyFont: { size: isMobile ? 10 : 12 },
          titleFont: { size: isMobile ? 12 : 14 },
          callbacks: {
            label: function (context) {
              if (isScatter) {
                const date = new Date(context.parsed.x);
                return [
                  `Date: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
                  `Price: $${context.parsed.y.toFixed(2)}`,
                ];
              }
              if (context.dataset.label.includes("Average Price")) {
                return [`Price: $${context.parsed.y.toFixed(2)}`];
              }

              return [
                `Price: $${context.parsed.y.toFixed(2)}`,
                `Quantity: ${JSON.stringify(context.raw.z)}`,
              ];
            },
          },
        },
        zoom: {
          pan: { enabled: true, mode: "xy", threshold: 5 },
          zoom: {
            wheel: { enabled: true, speed: 0.1 },
            pinch: { enabled: true },
            mode: "xy",
            onZoomComplete: ({ chart }) => {
              chart.update("none");
            },
          },
          limits: { y: { min: 0, max: "original", minRange: 10 } },
        },
      },
      scales: {
        x: {
          type: isScatter ? "time" : "category",
          time: {
            unit: "day",
            tooltipFormat: "MMM d, yyyy HH:mm",
            displayFormats: { hour: "HH:mm" },
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
            drawOnChartArea: !isScatter,
          },
          ticks: {
            color: "#f0f0f0",
            maxRotation: 45,
            minRotation: 45,
            autoSkip: true,
            maxTicksLimit: 10,
            font: { size: isMobile ? 8 : 10 },
          },
          title: {
            display: isScatter,
            text: "Date",
            color: "#f0f0f0",
          },
        },
        y: {
          beginAtZero: false,
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "#f0f0f0",
            callback: (value) => `$${value}`,
            font: { size: isMobile ? 8 : 10 },
          },
          title: {
            display: true,
            text: "Price ($)",
            color: "#f0f0f0",
            font: { weight: "bold" },
          },
        },
      },
      interaction: { intersect: false, mode: "nearest" },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const clickedElement = elements[0];
          const dataIndex = clickedElement.index;
          const clickedData =
            CHART_CONFIG.chartData[
              CHART_CONFIG.chartData.length - dataIndex - 1
            ];
          const buyPriceEl = document.getElementById("buyPrice");
          const sellPriceEl = document.getElementById("targetPrice");

          const sellPrice = parseFloat(sellPriceEl.value);
          const buyPrice = parseFloat(buyPriceEl.value);
          const clickedPrice = clickedData.price;

          if (clickedPrice) {
            if (sellPrice && buyPrice) {
              if (clickedPrice > sellPrice) {
                sellPriceEl.value = clickedPrice;
              } else if (clickedPrice < buyPrice) {
                buyPriceEl.value = clickedPrice;
              } else {
                buyPriceEl.value = clickedPrice;
              }
            } else if (!sellPrice && buyPrice) {
              if (clickedPrice > buyPrice) {
                sellPriceEl.value = clickedPrice;
              } else {
                sellPriceEl.value = buyPrice;
                buyPriceEl.value = clickedPrice;
              }
            } else {
              buyPriceEl.value = clickedPrice;
            }
          }

          window.calculateResultsGlobal();
        }
      },
    };
  }
}

/**
 * Render candlestick chart
 */
async function renderCandlestickChart() {
  if (!CHART_CONFIG.chartData.length) {
    DOM_ELEMENTS.chartStatus.innerHTML = `
      <div class="status">
        <i class="fas fa-info-circle"></i> No data available for candlestick chart
      </div>
    `;
    return;
  }

  const itemName = DOM_ELEMENTS.itemName.value.trim();
  const itemId = DOM_ELEMENTS.itemId.value
    ? parseInt(DOM_ELEMENTS.itemId.value)
    : null;

  if (!itemName && !itemId) return;

  const params = [];

  if (itemName) {
    params.push({
      field: "name",
      operator: "eq",
      value: itemName,
    });
  }

  if (itemId) {
    params.push({
      field: "item_id",
      operator: "eq",
      value: itemId,
    });
  }

  try {
    const response = await fetch(
      `${API_CONFIG.BASE_URL}?endpoint=
        API_CONFIG.ENDPOINTS.ITEM_MARKET_DAY_TRADE
      }&${urlParamsFormatter(params)}`,
      API_CONFIG.REQUEST_CONFIG
    );

    if (!response.ok) throw new Error("Failed to fetch candlestick data");

    const data = await response.json();

    if (typeof window.candlestickChart === "function") {
      window.candlestickChart.dispose();
    }

    window.candlestickChart = AmCharts.makeChart("candlestickChart", {
      type: "serial",
      theme: "light",
      dataDateFormat: "YYYY-MM-DD",
      colors: ["#ff7e5f", "#feb47b"],
      valueAxes: [
        {
          position: "left",
          gridColor: "rgba(255, 255, 255, 0.1)",
          axisColor: "#f0f0f0",
          color: "#f0f0f0",
        },
      ],
      graphs: [
        {
          id: "g1",
          proCandlesticks: true,
          balloonText:
            "Open:<b>[[open]]</b><br>Low:<b>[[low]]</b><br>High:<b>[[high]]</b><br>Close:<b>[[close]]</b>",
          closeField: "close",
          fillColors: "#7f8da9",
          highField: "high",
          lineColor: "#7f8da9",
          lineAlpha: 1,
          lowField: "low",
          fillAlphas: 0.9,
          negativeFillColors: "#db4c3c",
          negativeLineColor: "#db4c3c",
          openField: "open",
          title: "Price:",
          type: "candlestick",
          valueField: "close",
        },
      ],
      chartScrollbar: {
        graph: "g1",
        graphType: "line",
        scrollbarHeight: 30,
        color: "#f0f0f0",
        selectedBackgroundColor: "#ff7e5f",
      },
      chartCursor: {
        valueLineEnabled: true,
        valueLineBalloonEnabled: true,
        valueLineAlpha: 0.5,
      },
      categoryField: "date",
      categoryAxis: {
        parseDates: true,
        gridColor: "rgba(255, 255, 255, 0.1)",
        axisColor: "#f0f0f0",
        color: "#f0f0f0",
      },
      dataProvider: data,
      export: {
        enabled: true,
        position: "bottom-right",
      },
    });

    window.candlestickChart.addListener("rendered", () => {
      window.candlestickChart.zoomToIndexes(data.length - 50, data.length - 1);
    });

    window.addEventListener("resize", () => {
      if (window.candlestickChart) {
        window.candlestickChart.invalidateSize();
      }
    });
  } catch (error) {
    console.error("Error rendering candlestick chart:", error);
    DOM_ELEMENTS.chartStatus.innerHTML = `
      <div class="status">
        <i class="fas fa-exclamation-triangle"></i> Error loading candlestick data: ${error.message}
      </div>
    `;
  }
}

/**
 * Populate data table
 */
function populateTable() {
  DOM_ELEMENTS.tableBody.innerHTML = "";
  CHART_CONFIG.chartData.sort(
    (a, b) => new Date(b.createddate) - new Date(a.createddate)
  );

  CHART_CONFIG.chartData.forEach((item) => {
    const date = new Date(item.createddate);
    const formattedDate = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")} ${date
      .getUTCHours()
      .toString()
      .padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}`;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${item.item_id}</td>
      <td>${item.name}</td>
      <td>$${item.average_price.toFixed(2)}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>${item.quantity || 1}</td>
    `;
    DOM_ELEMENTS.tableBody.appendChild(row);
  });
}

/**
 * Toggle table visibility
 */
function toggleTable() {
  const isExpanded = DOM_ELEMENTS.dataTable.classList.contains("expanded");
  DOM_ELEMENTS.dataTable.classList.toggle("expanded");
  DOM_ELEMENTS.toggleTableBtn.innerHTML = isExpanded
    ? '<i class="fas fa-table"></i> Show Data Table'
    : '<i class="fas fa-times"></i> Hide Data Table';
}

/**
 * Reset filters
 */
function resetFilters() {
  DOM_ELEMENTS.startDate.value = formattedToday;
  DOM_ELEMENTS.endDate.value = formattedToday;
  DOM_ELEMENTS.itemName.value = "";
  DOM_ELEMENTS.itemId.value = "";
  DOM_ELEMENTS.startTime.value = "";
  DOM_ELEMENTS.endTime.value = "";
  DOM_ELEMENTS.timePickerGroup.style.display = "none";

  DOM_ELEMENTS.timeframeBtns.forEach((btn) => btn.classList.remove("active"));
  document
    .querySelector('.timeframe-btn[data-timeframe="day"]')
    .classList.add("active");
  CHART_CONFIG.currentTimeframe = "day";

  fetchData();

  if (refreshInterval) {
    toggleAutoRefresh(); // This will stop the auto-refresh
  }
}

/**
 * Navigate between days
 */
function navigateDays(days) {
  const startDate = new Date(DOM_ELEMENTS.startDate.value);
  const endDate = new Date(DOM_ELEMENTS.endDate.value);

  // Calculate difference in days
  const diffDays =
    Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Move both dates by the full range (diffDays + 1) days
  startDate.setDate(startDate.getDate() + days * diffDays);
  endDate.setDate(endDate.getDate() + days * diffDays);

  // Format dates back to YYYY-MM-DD
  DOM_ELEMENTS.startDate.value = formatDate(startDate);
  DOM_ELEMENTS.endDate.value = formatDate(endDate);

  // If we were showing a single day, keep showing a single day
  if (diffDays === 1) {
    DOM_ELEMENTS.endDate.value = formatDate(startDate);
  }

  fetchData();
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Add this function to toggle auto-refresh
function toggleAutoRefresh() {
  if (refreshInterval) {
    // If interval exists, turn it off
    clearInterval(refreshInterval);
    refreshInterval = null;
    DOM_ELEMENTS.autoRefreshToggle.innerHTML =
      '<i class="fas fa-sync-alt"></i> Enable Auto-Refresh';
    DOM_ELEMENTS.autoRefreshToggle.classList.remove("active");
  } else {
    // If no interval, turn it on
    refreshInterval = setInterval(() => {
      fetchData((data) => {
        const first = data[0];
        if (first.average_price >= first.price) {
          console.log("Hit the price!!!!");
        }
      });
    }, REFRESH_INTERVAL_MS);
    DOM_ELEMENTS.autoRefreshToggle.innerHTML =
      '<i class="fas fa-sync-alt"></i> Auto-Refresh ON';
    DOM_ELEMENTS.autoRefreshToggle.classList.add("active");
    // Fetch immediately when enabling
    fetchData((data) => {
      const first = data[0];
      if (first.average_price >= first.price) {
        console.log("Hita the price!!!!");
      }
    });
  }
}

// Add this to your existing DOM_ELEMENTS object
DOM_ELEMENTS.bestItemsToggle = document.getElementById("bestItemsToggle");
DOM_ELEMENTS.bestItemsSidebar = document.getElementById("bestItemsSidebar");
DOM_ELEMENTS.bestItemsList = document.getElementById("bestItemsList");

// Add this to your setupEventListeners function
DOM_ELEMENTS.bestItemsToggle.addEventListener("click", function () {
  DOM_ELEMENTS.bestItemsSidebar.classList.toggle("visible");
  this.innerHTML = DOM_ELEMENTS.bestItemsSidebar.classList.contains("visible")
    ? '<i class="fas fa-times"></i>'
    : '<i class="fas fa-list"></i>';

  // Load items when sidebar is opened for the first time
  if (DOM_ELEMENTS.bestItemsSidebar.classList.contains("visible")) {
    fetchBestItems();
  }
});

// Add this new function to fetch best items
async function fetchBestItems() {
  try {
    DOM_ELEMENTS.bestItemsList.innerHTML = `
                    <div class="loading-items">
                        <div class="loading-spinner"></div>
                        <div>Loading items...</div>
                    </div>
                `;

    const response = await fetch(
      `${API_CONFIG.BASE_URL}?endpoint=${API_CONFIG.ENDPOINTS.BEST_ITEMS_TO_BUY}`,
      API_CONFIG.REQUEST_CONFIG
    );
    const data = await response.json();

    if (data.length === 0) {
      DOM_ELEMENTS.bestItemsList.innerHTML = `
                        <div style="text-align: center; color: #a0a0ff; padding: 20px;">
                            No profitable items found
                        </div>
                    `;
      return;
    }

    DOM_ELEMENTS.bestItemsList.innerHTML = "";

    data.forEach((item) => {
      const formatPrice = (price) => {
        return (
          "₽" +
          parseFloat(price)
            .toFixed(2)
            .replace(/\d(?=(\d{3})+\.)/g, "$&,")
        );
      };

      const row = document.createElement("div");
      row.className = "best-item-row";

      row.innerHTML = `
                        <div>
                            <div class="best-item-name">${item.name}</div>
                            <div class="best-item-id">ID: ${item.item_id}</div>
                        </div>
                        <div class="best-item-price">${formatPrice(
                          item.avg_actual_price_last_week
                        )}</div>
                        <div class="best-item-profit">${formatPrice(
                          item.margin
                        )}</div>
                        <div class="best-item-margin">+${
                          item.margin_percent
                        }%</div>
                    `;

      // Add click event to populate filters with this item
      row.addEventListener("click", () => {
        DOM_ELEMENTS.itemName.value = item.name;
        DOM_ELEMENTS.itemId.value = item.item_id;
        DOM_ELEMENTS.bestItemsSidebar.classList.remove("visible");
        DOM_ELEMENTS.bestItemsToggle.innerHTML = '<i class="fas fa-list"></i>';
        fetchData();
      });

      DOM_ELEMENTS.bestItemsList.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching best items:", error);
    DOM_ELEMENTS.bestItemsList.innerHTML = `
                    <div style="text-align: center; color: #ff7e5f; padding: 20px;">
                        Error loading items. Please try again.
                    </div>
                `;
  }
}

// Initialize the best items sidebar
setTimeout(() => {
  if (!DOM_ELEMENTS.bestItemsSidebar.classList.contains("visible")) {
    DOM_ELEMENTS.bestItemsSidebar.classList.add("visible");
    DOM_ELEMENTS.bestItemsToggle.innerHTML = '<i class="fas fa-times"></i>';
    fetchBestItems();
  }
}, 300);
