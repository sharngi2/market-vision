// Set dimensions
const margin = {top: 20, right: 30, bottom: 30, left: 60};
// Calculate width based on container for responsiveness
const width = 900 - margin.left - margin.right;
const height = 450 - margin.top - margin.bottom;

async function fetchData() {
    const ticker = document.getElementById('tickerInput').value;
    const container = d3.select("#chart-container");
    container.html("<p style='text-align:center; padding:50px; color:#666;'>Running Quantitative Model...</p>");

    try {
        const response = await fetch(`/api/predict/${ticker}`);
        const result = await response.json();

        if (result.status === 'error') {
            container.html(`<p style='color:red; text-align:center;'>${result.message}</p>`);
            return;
        }

        renderChart(result.data, result.ticker);
        updateCards(result.data);

    } catch (error) {
        console.error(error);
        container.html("<p>Error fetching data.</p>");
    }
}

function renderChart(data, tickerName) {
    d3.select("#chart-container").html("");

    const parseDate = d3.timeParse("%Y-%m-%d");
    const formatDate = d3.timeFormat("%b %d");
    data.forEach(d => {
        if(typeof d.date === 'string') d.date = parseDate(d.date);
    });

    const svg = d3.select("#chart-container")
        .append("svg")
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // SCALES
    const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width]);
    
    // Y-Axis domain with padding
    const yMin = d3.min(data, d => d.lower);
    const yMax = d3.max(data, d => d.upper);
    const y = d3.scaleLinear().domain([yMin * 0.98, yMax * 1.02]).range([height, 0]);

    // AXES (Custom styled)
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(6))
        .attr("color", "#555")
        .style("font-size", "12px");

    svg.append("g")
        .call(d3.axisLeft(y).tickFormat(d => "$" + d))
        .attr("color", "#555")
        .style("font-size", "12px");

    // 1. BOLLINGER BANDS (Area)
    svg.append("path")
        .datum(data)
        .attr("fill", "rgba(229, 9, 20, 0.1)") // Low opacity red
        .attr("stroke", "none")
        .attr("d", d3.area()
            .x(d => x(d.date))
            .y0(d => y(d.lower))
            .y1(d => y(d.upper))
        );

    // 2. SMA (Trend Line)
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#666")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,4")
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.sma)));

    // 3. PRICE (Main Line)
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#E50914")
        .attr("stroke-width", 2.5)
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.close)));

    // --- INTERACTIVITY: HOVER TOOLTIP ---
    
    // Create an overlay rectangle to catch mouse events
    const tooltip = d3.select("#tooltip");
    const focusLine = svg.append("line")
        .attr("stroke", "#fff")
        .attr("stroke-dasharray", "3,3")
        .attr("y1", 0)
        .attr("y2", height)
        .style("opacity", 0);

    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all")
        .on("mouseover", () => { focusLine.style("opacity", 1); tooltip.style("display", "block"); })
        .on("mouseout", () => { focusLine.style("opacity", 0); tooltip.style("display", "none"); })
        .on("mousemove", mousemove);

    function mousemove(event) {
        // Find closest date to mouse
        const bisect = d3.bisector(d => d.date).left;
        const x0 = x.invert(d3.pointer(event)[0]);
        const i = bisect(data, x0, 1);
        const selectedData = data[i];

        if(selectedData) {
            focusLine.attr("transform", `translate(${x(selectedData.date)},0)`);
            
            tooltip
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 15) + "px")
                .html(`
                    <strong>${formatDate(selectedData.date)}</strong><br>
                    Price: $${selectedData.close}<br>
                    Trend: $${selectedData.sma}
                `);
        }
    }
}

function updateCards(data) {
    const latest = data[data.length - 1];
    document.getElementById('price-display').innerText = `$${latest.close.toFixed(2)}`;
    document.getElementById('trend-display').innerText = `$${latest.sma.toFixed(2)}`;
    
    const spread = latest.upper - latest.lower;
    const volatilityNode = document.getElementById('volatility-display');
    
    if (spread > (latest.close * 0.15)) {
        volatilityNode.innerText = "HIGH";
        volatilityNode.style.color = "#E50914"; // Red
    } else {
        volatilityNode.innerText = "STABLE";
        volatilityNode.style.color = "#46d369"; // Green
    }
}

fetchData();