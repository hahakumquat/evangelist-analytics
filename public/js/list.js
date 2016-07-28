function makeToolbar(data) {
    var $list = $("#list");
    var ids = Object.keys(data);
    ids.forEach(function(id) {
        var button = ("<label><input type='checkbox' class=list-el "
                      + " id=" + data[id].id + " checked>&nbsp;"
                  + data[id].screen_name + "</label><br>");
        $list.append(button);
    });
    $("body").append($list);
}

