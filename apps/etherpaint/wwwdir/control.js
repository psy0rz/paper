'use strict';

//basic control stuff for the GUI

var control = {};

control.Modes =
    {
        Point: 1,
        Draw: 2,
        Delete: 3,
        Select: 4
    };

control.mode = control.Modes.Point;
control.send_draw_type = event.DrawType.PolyLine;
control.send_draw_color = event.DrawType.PolyLine;

control.last_x = 0;
control.last_y = 0;

//selected tools and colors for draw mode
control.selected = {};


//called when page is ready
control.start = function () {

    //calculate default zoom for this screen
    const zoom_width = 1920;
    // control.zoom_percentage = document.querySelector('#paper-container').clientWidth / zoom_width * 100;
    control.zoom_percentage = 100;
    paper.setZoom(control.zoom_percentage / 100);

    // control.svg_element.addEventListener('mousemove', control.onMouseMove);
    document.querySelector("#viewer").addEventListener('pointermove', control.onPointerMove, {passive: true});
    document.querySelector("#viewer").addEventListener('pointerdown', control.onPointerDown, {passive: false});
    document.querySelector("#viewer").addEventListener('pointerup', control.onPointerUp, {passive: true});
    document.querySelector("#viewer").addEventListener('pointercancel', control.onPointerCancel, {passive: true});

}

control.deselectAll = function () {
    for (const e of document.querySelectorAll(".selected")) {
        e.classList.remove("selected");
    }

}

control.select = function (target) {

    if (target.id != 'viewer') {

        //select
        target.classList.add("selected");

    }
}

control.deleteSelected = function () {
    for (const e of document.querySelectorAll(".selected")) {
        e.classList.remove("selected"); //deselect as well (its hidden now)
        paper.sendDeleteElement(e);
    }
}

control.onPointerDown = function (m) {
    //calculate action svg paper location
    const point = paper.viewer_svg.point(m.pageX, m.pageY);
    const x = Math.round(point.x);
    const y = Math.round(point.y);

    control.last_x = x;
    control.last_y = y;

    paper.sendCursor(x, y);

    //do we need to send any tool-selects?
    if (control.send_draw_type !== undefined) {
        paper.sendDrawIncrement(event.IncrementalType.SelectDrawType, control.send_draw_type);
        control.send_draw_type = undefined;

    }


    if (m.buttons & 1) {
        control.primaryDown = true;
        switch (control.mode) {
            case control.Modes.Draw:
                paper.sendDrawIncrement(event.IncrementalType.PointerStart, x, y);
                break;
            case control.Modes.Delete:
                control.deleteSelected();
                break;

        }
    }

    m.preventDefault();
};


//de-coalesced events
control.onPointerMove_ = function (m) {
    //calculate actual svg paper location
    const point = paper.viewer_svg.point(m.pageX, m.pageY);
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    if (x != control.last_x || y != control.last_y) {

        //update latest cursor location
        paper.sendCursor(x, y);

        switch (control.mode) {
            case control.Modes.Draw:
                if (control.primaryDown)
                    paper.sendDrawIncrement(event.IncrementalType.PointerMove, x, y);
                break;
            case control.Modes.Delete:
                if (m.target.id != 'viewer') {
                    control.deselectAll();
                    control.select(m.target);
                    if (control.primaryDown)
                        control.deleteSelected();
                }
                break;

        }

        control.last_x = x;
        control.last_y = y;
    }
}

control.onPointerMove = function (m) {
    if (m.getCoalescedEvents) {
        for (const coalesced of m.getCoalescedEvents()) {
            control.onPointerMove_(coalesced);
        }
    } else {
        control.onPointerMove_(m);
    }
};


control.onPointerUp = function (m) {
    //calculate action svg paper location
    const point = paper.viewer_svg.point(m.pageX, m.pageY);
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    control.last_x = x;
    control.last_y = y;

    if (control.primaryDown) {
        if (control.mode == control.Modes.Draw) {

            paper.sendDrawIncrement(event.IncrementalType.PointerEnd, x, y);
            paper.updateViewport();
        }
        control.primaryDown = false;
    }
};

control.onPointerCancel = function (m) {
    //calculate action svg paper location
    const point = paper.viewer_svg.point(m.pageX, m.pageY);

    if (control.mode == control.Modes.Draw) {
        paper.sendDrawIncrement(event.IncrementalType.PointerCancel, point.x, point.y);
    }
};


control.highlightTool = function (activate) {
    // document.querySelectorAll('#tools ons-toolbar-button').forEach(function(e)
    // {
    //     e.setAttribute("modifier", "");
    // })
    //deselct others
    document.querySelectorAll('#tools .button').forEach(function (e) {
        e.classList.remove("is-primary");
    })
    activate.classList.add("is-primary");

}


control.onClickToolPointer = function (e) {
    control.highlightTool(e);
    control.mode = control.Modes.Point;

};


// control.onClickToolSelect = function (e) {
//     control.highlightTool(e);
//     control.mode=control.Modes.Select;
// };


control.onClickToolPolyline = function (e) {
    control.highlightTool(e);
    // control.mode=control.Modes.Draw;
    // control.selected.drawType=event.DrawType.PolyLine;
    paper.viewer_element.style.touchAction = "manipulation";
    control.mode = control.Modes.Draw;
    control.send_draw_type = event.DrawType.PolyLine;
};

control.onClickToolRect = function (e) {
    control.highlightTool(e);
    paper.viewer_element.style.touchAction = "manipulation";

    control.mode = control.Modes.Draw;
    control.send_draw_type = event.DrawType.Rectangle;
};

control.onClickToolDelete = function (e) {
    control.highlightTool(e);
    control.mode = control.Modes.Delete;

};


control.onClickZoomOut = function (e) {
    control.zoom_percentage = control.zoom_percentage - 10;
    paper.setZoom(control.zoom_percentage / 100);
};

control.onClickZoomIn = function (e) {
    control.zoom_percentage = control.zoom_percentage + 10;
    paper.setZoom(control.zoom_percentage / 100);
};


//todo: show on GUI
m.handlers[event.EventUnion.Error] = (msg, event_index) => {
    const error = msg.events(event_index, new event.Error());
    console.error("Server reports error: " + error.description());
}


control.onClickHistory = function (e) {
    document.querySelector("#history").classList.remove("is-hidden");
    document.querySelector("#history-slider").max = paper.increments.length - 1;
    document.querySelector("#history-slider").value = paper.increments.length - 1;

    paper.paused = true;
};

control.onClickHistoryClose = function (e) {
    document.querySelector("#history").classList.add("is-hidden");
    paper.paused = false;
    paper.target_index = paper.increments.length - 1;
};

control.onInputHistory = function (e) {
    paper.target_index = e.value;
}