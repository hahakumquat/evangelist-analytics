$.ajax({
    url: "/data",
    success:
    function(data) {
        makeToolbar(data);
        var stackedBar = new StackedBarChart(data, "#stackedBarChart");
        stackedBar.initVis();
        stackedBar.updateVis();
        var stackedArea = new StackedAreaChart(data, "#stackedAreaChart");
        stackedArea.initVis();
        stackedArea.updateVis();
        addListeners(data, [stackedArea, stackedBar]);
    }
});

function addListeners(data, visArr) {
    var ids = Object.keys(data);
    ids.forEach(function(id) {
        $("#" + data[id].id).click(function() {
            for (var k = 0; k < visArr.length; k++) {
                visArr[k].updateVis();
            }
        });
    });
}
