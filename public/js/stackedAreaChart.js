// Creates initial bac chart object
StackedAreaChart = function(data, parentElement) {

    /* Constructor */
    var vis = this;
    var margin = {
        left: 40,
        right: 20,
        top: 20,
        bottom: 70
    };
    var WIDTH = 500;
    var HEIGHT = 350;
    
    vis.margin = margin;
    vis.parentElement = parentElement;
    vis.data = data;
    vis.width = WIDTH - margin.left - margin.right;
    vis.height = HEIGHT - margin.top - margin.bottom;
    vis.svg = d3.select(parentElement).append("svg")
        .attr("width", WIDTH)
        .attr("height", HEIGHT)
        .append("g")
        .attr("id", "controller")
        .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")");
    
    vis.area = d3.area()
        .x(function(d) {
            return vis.xScale(new Date(d.data.date));
        })
        .y0(function(d) { return vis.yScale(d[0]); })
        .y1(function(d) { return vis.yScale(d[1]); });
}

// Creates static elements
StackedAreaChart.prototype.initVis = function() {
    var vis = this;
    
    vis.xScale = d3.scaleTime()
        .rangeRound([0, vis.width]);

    vis.yScale = d3.scaleLinear()
        .rangeRound([vis.height, 0]);

    vis.colorScale = d3.scaleOrdinal()
        .range(['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', 
'#ec7014', '#cc4c02', '#993404', '#662506'].reverse());

    vis.xAxis = d3.axisBottom(vis.xScale);
    vis.yAxis = d3.axisLeft(vis.yScale);
    
    vis.svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", "translate(" + 0 + ", " + (vis.height) + ")");
    vis.svg.append("g")
        .attr("class", "axis y-axis")        
}

// Converts from getMonth to a month name since numerical month isn't date-able
Date.prototype.getMonthName = function() {
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    return months[this.getMonth()];
}

// organizes vis.data into stackable data
StackedAreaChart.prototype.wrangleData = function() {
    
    var vis = this;
    var raw = vis.data.filter(function(d) {
        if ($("#" + d.id).prop("checked"))
            return true;
    });
    var names = vis.names = Object.keys(raw).map(function(p) { return raw[p].screen_name });

    // get all unique year-month data for all people
    // creates a dictionary of dates -> objects of people
    var dateSet = new Set();
    var stackObj = {};
    for (var k = 0, c = names.length; k < c; k++) {
        var person = raw[k];
        for (var j = 0, cc = person.statuses.length; j < cc; j++) {
            var status = person.statuses[j];
            var date = new Date(status.created_at);
            var month = date.getMonthName();
            var year = date.getFullYear();
            var moYr = month + " " + year;
            if (!dateSet.has(moYr)) {
                stackObj[moYr] = {};
                names.forEach(function(screen_name) {
                    stackObj[moYr][screen_name] = {
                        favorites: 0,
                        tweets: 0,
                        retweets: 0
                    }
                });
                dateSet.add(moYr);
            }
            stackObj[moYr][person.screen_name].favorites += status.favorite_count;
            stackObj[moYr][person.screen_name].tweets += 1;
            stackObj[moYr][person.screen_name].retweets += status.retweet_count;
        }
    }

    var toStack = stackFormat(stackObj, names);
    var stack = d3.stack()
        .keys(names)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);

    vis.parsedData = stack(toStack);

    var topPerson = vis.parsedData[vis.parsedData.length - 1];
    var maxY = 0;
    for (var k = 0; k < topPerson.length; k++) {
        if (maxY < topPerson[k][1])
            maxY = topPerson[k][1];
    }
    vis.xScale.domain(d3.extent(toStack, function(d) { return new Date(d.date); }));
    vis.yScale.domain([0, maxY]).nice();
    vis.colorScale.domain(names);
}

StackedAreaChart.prototype.updateVis = function() {
    vis = this;

    vis.svg.selectAll(".layer, .legend").remove();
    
    vis.wrangleData();

    var layer = vis.svg.selectAll(".layer")
        .data(vis.parsedData)
        .enter().append("g")
        .attr("class", "layer")

        .append("path")
        .attr("class", "area")
        .attr("d", vis.area)
        .attr("fill", function(d) { return vis.colorScale(d.key); })
        .on("mouseover", function(d) {
            console.log(d);
        });

    var legend = vis.svg.selectAll(".legend")
        .data(vis.parsedData)
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function(d, i) { return "translate(0," + (vis.names.length * 20 - i * 20) + ")"; })
        .style("font", "10px sans-serif");

    legend.append("rect")
        .attr("x", vis.width - 18)
        .attr("width", 18)
        .attr("height", 18)
        .attr("fill", function(d) { return vis.colorScale(d.key) })
    
    legend.append("text")
        .attr("x", vis.width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .text(function(d) { return d.key; });

    vis.svg.select(".x-axis").transition()
        .call(vis.xAxis
              .tickFormat(d3.timeFormat("%b %Y")))
        .selectAll("text")
        .attr("text-anchor", "start")
        .attr("x", 10)
        .attr("y", -5)
        .attr("transform", "rotate(90)");
    vis.svg.select(".y-axis").transition().call(vis.yAxis);
}

// converts from object structure to stackable structure
function stackFormat(data, names) {
    var arr = [];
    var keys = Object.keys(data);
    for (var k = 0; k < keys.length; k++) {
        var dateObj = data[keys[k]];
        var obj = {
            date: keys[k]
        };
        for (var j = 0; j < names.length; j++) {
            obj[names[j]] = aggregate(dateObj[names[j]]);
        }
        arr.push(obj);
    }
    return arr;
}

// function that defines how to calculate a value in the stacked area chart
function aggregate(obj) {
    var tweets = obj.tweets;
    var favorites = obj.favorites;
    var retweets = obj.retweets;
    // return favorites + retweets / Math.max(tweets, 1);
    return favorites / 100 +  Math.max(1, retweets) / (Math.max(1, tweets));
}
