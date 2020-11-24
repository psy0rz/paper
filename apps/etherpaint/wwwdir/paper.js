'use strict';

//actual paper handling stuff. sends/receives events and reads/writes to SVG

const paper = {};


paper.start = function (viewer_element, paper_element, scratch_element, container_element) {

    paper.viewer_element = viewer_element;
    paper.viewer_container = viewer_element.parentNode;
    paper.paper_element = paper_element;
    paper.scratch_element = scratch_element;
    paper.container_element = container_element;

    paper.viewer_svg = SVG(viewer_element);
    paper.paper_svg = SVG(paper_element);
    paper.scratch_svg = SVG(scratch_element);

    // paper.paper_svg.text("Alleen pencil en history slider werken. ").attr('font-size', '200%');



    paper.clear();
    //paper.setZoom(1);

    //start frame timer
    paper.onAnimationFrame();
    // setInterval(paper.updateViewport, 1000);
    // paper.setZoom(1);

}

paper.clear = function () {
    paper.paper_svg.clear();
    paper.scratch_svg.clear();
    // paper.increments = [];
    // paper.reverse_increments = [];
    // paper.increment_index = -1;
    paper.target_index = -1;
    // paper.changed_clients = new Set();
    paper.paused = false;
    paper.echo_client = paper.getClient(0);

    paper.scrollLeft = 0;
    paper.scrollTop = 0;
    paper.velocityX = 0;
    paper.velocityY = 0;
    paper.panning=false;

    paper.zoom_factor = 1;
    paper.zoom_update_factor = 1;

    paper.paper_draw=new PaperDraw(paper.paper_svg, paper.scratch_svg);

}

//send join to server
paper.join = function (id) {
    m.add_event(
        event.EventUnion.Join,
        event.Join.createJoin(
            m.builder,
            m.builder.createString(id)
        ));

    m.send();
}


//server tells us we are joined to a new session.
m.handlers[event.EventUnion.Join] = function (msg, event_index) {
    const join = msg.events(event_index, new event.Join());
    console.log("Joined shared session", join.id(), "as client", join.clientId());

    paper.client_id = join.clientId();
    paper.clear();

}


//update cursor info (onFrameTimer will send it when its time)
paper.sendCursor = function (x, y) {

    if (paper.cursor_x !== x || paper.cursor_y !== y) {
        paper.cursor_x = x;
        paper.cursor_y = y;
        paper.cursor_moved = true;
        if (test.recording)
            test.record([x,y]);


    }
}

//this is main function that is called from control.js to send actual drawing commands.
paper.sendDrawIncrement = function (type, p1, p2, p3) {

    // console.log(type, p1, p2, p3);

    //TODO: make sure it happens in animation frame
    //local echo (and determining if event has to be stored/undoable)
    const reverse = paper.echo_client.drawIncrement(type, p1, p2, p3);


    //delete temporary object if there is any
    if (type === event.IncrementalType.PointerEnd) {
        if (paper.echo_client.current_element) {
            paper.echo_client.current_element.remove();
            paper.echo_client.current_element = undefined;
        }
    }

    m.add_event(
        event.EventUnion.DrawIncrement,
        event.DrawIncrement.createDrawIncrement(
            m.builder,
            paper.client_id,
            type,
            p1,
            p2,
            p3,
            reverse !== undefined
        ));

    if (test.recording)
        test.record([type, p1, p2, p3]);
}


//received an incremental draw
m.handlers[event.EventUnion.DrawIncrement] = function (msg, event_index) {
    const draw_increment_event = msg.events(event_index, new event.DrawIncrement());

    paper.paper_draw.addIncrement(
        draw_increment_event.clientId(),
        draw_increment_event.type(),
        draw_increment_event.p1(),
        draw_increment_event.p2(),
        draw_increment_event.p3(),
        draw_increment_event.store()
    ]);




}



//draw increments until index. also store reverse increments or delete increments if they dont have a reverse.
//increments without a reverse are usually only for visual effect. (e.g. when drawing a rectangle)
//pay attention to performance in this one
paper.drawIncrements = function (index) {
    while (paper.increment_index < index) {

        paper.increment_index++;

        const increment = paper.increments[paper.increment_index];
        const client = paper.getClient(increment[0]);
        let reverse = [increment[0]]; //client_id
        reverse = reverse.concat(client.drawIncrement(increment[1], increment[2], increment[3], increment[4]));

        //we have more items than the reverse array?
        if (paper.increment_index === paper.reverse_increments.length) {
            //should we store it?
            if (increment[5]) //"store"
            {
                paper.reverse_increments.push(reverse);
                // console.log("STORE", increment);
            } else {
                // console.log("SKIP", increment);
                //we dont have a reverse, so remove it from increments
                paper.increments.splice(paper.increment_index, 1);
                paper.increment_index--;
                paper.target_index--;
                index--;
            }
        }

        // console.log("drawn: i=",paper.increment_index, index, increment);

    }

    // console.log("increments", index, paper.increment_index);
}

paper.drawReverseIncrements = function (index) {
    while (paper.increment_index > index) {

        const increment = paper.reverse_increments[paper.increment_index];
        if (!(increment === undefined)) {
            const client = paper.getClient(increment[0]);

            client.drawIncrement(increment[1], increment[2], increment[3], increment[4]);
        }

        paper.increment_index = paper.increment_index - 1;

    }

}


paper.slideTo = function (index) {

    // console.log("SLIDE", paper.increment_index, index);
    if (paper.increment_index > index) {
        paper.drawReverseIncrements(index);
        // console.log("REV");
    } else if (paper.increment_index < index)
        paper.drawIncrements(index);

}


paper.undo = function()
{

}

//handle pinch zoom/panning on mobile
//much more complicated than you would have hoped :)
paper.animatePanZoom = function ()
{
    //zoom stuff
    if (paper.zoom_update_factor!=paper.zoom_factor) {

        if (!paper.panning)
        {
            //get current coords (on desktop)
            paper.scrollLeft=paper.viewer_container.scrollLeft;
            paper.scrollTop=paper.viewer_container.scrollTop;
        }

        //calculate curerently unzoomed coordinates of zoom-point
        const origLeft = (paper.scrollLeft + paper.zoom_x) / paper.zoom_factor;
        const origTop = (paper.scrollTop + paper.zoom_y) / paper.zoom_factor;

        //actually do the zoom
        paper.zoom_factor=paper.zoom_update_factor;
        paper.viewer_svg.viewbox(0, 0, Math.round(paper.viewer_element.scrollWidth / paper.zoom_factor), Math.round(paper.viewer_element.scrollWidth / paper.zoom_factor));

        //recaclulate new zoomed coordinates of zoom-point
        paper.scrollLeft = (origLeft * paper.zoom_factor) - paper.zoom_x;
        paper.scrollTop = (origTop * paper.zoom_factor) - paper.zoom_y;
        paper.panning=true;
    }


    if (paper.panning) {
        //velocity panning (flinging)
        if (paper.velocityX > 1) {
            paper.scrollLeft += paper.velocityX;
            paper.velocityX -= 1;
        } else if (paper.velocityX < -1) {
            paper.scrollLeft += paper.velocityX;
            paper.velocityX += 1;
        }

        if (paper.velocityY > 1) {
            paper.scrollTop += paper.velocityY;
            paper.velocityY -= 1;
        } else if (paper.velocityY < -1) {
            paper.scrollTop += paper.velocityY;
            paper.velocityY += 1;
        }


        //actual pan execution
        if (Math.round(paper.viewer_container.scrollLeft != Math.round(paper.scrollLeft)) || Math.round(paper.viewer_container.scrollTop) != Math.round(paper.scrollTop)) {
            if (paper.scrollLeft < 0) {
                paper.scrollLeft = 0;
                paper.velocityX = 0;
            }

            if (paper.scrollTop < 0) {
                paper.scrollTop = 0;
                paper.velocityY = 0;
            }

            // console.log("SCROLLTO", paper.scrollLeft, paper.scrollTop);
            paper.viewer_container.scrollTo(Math.round(paper.scrollLeft), Math.round(paper.scrollTop));

        }
        else
        {
            //we dont want to upset regular scrolling on desktop browsers. so stop updating scroll position we're done:
            paper.panning=false;
        }
    }

}

//draw data and send collected data
// paper.cursors = {};
// paper.cursor_events = {};
// paper.cursor_changed_clients = new Set();
paper.onAnimationFrame = function (s) {


    //only if we are connected
    if (!m.ws || m.ws.readyState !== 1) {
        window.requestAnimationFrame(paper.onAnimationFrame);
        return;
    }

    paper.animatePanZoom();

    paper.paper_draw.draw();



    //SEND stuff
    //buffer empty enough?
    //todo: some kind of smarter throttling
    if (m.ws && m.ws.bufferedAmount === 0) {
        //anything to send at all?
        if (paper.cursor_moved || !m.is_empty()) {

            if (paper.cursor_moved) {
                //add latest cursor event
                m.add_event(
                    event.EventUnion.Cursor,
                    event.Cursor.createCursor(
                        m.builder,
                        paper.client_id,
                        paper.cursor_x,
                        paper.cursor_y,
                    ))
                paper.cursor_moved = false;
            }


            m.send();
        }
    }


   window.requestAnimationFrame(paper.onAnimationFrame);
    //testing:
    // setTimeout(paper.onAnimationFrame, 1000);
}


//received a cursor event.
//only store/replace it to handle performance issues gracefully. (e.g. skip updates instead of queue them)
m.handlers[event.EventUnion.Cursor] = (msg, event_index) => {
    const cursor_event = msg.events(event_index, new event.Cursor());
    const client_id = cursor_event.clientId();

    paper.paper_draw.updateCursor(client_id, cursor_event);



}


//set viewport to current zoomfactor and bounding box.
paper.updateViewport = function () {

    //we want the bounding box width + 1 x "screen size" around.
    // const bbox = paper.paper_svg.bbox();
    // const w = Math.round(bbox.x2 + 1 * paper.container_element.offsetWidth);
    // const h = Math.round(bbox.y2 + 1 * paper.container_element.offsetHeight);

    // paper.viewer_svg.viewbox(0, 0, Math.round(paper.viewer_element.scrollWidth / paper.zoom_factor), Math.round(paper.viewer_element.scrollWidth / paper.zoom_factor));
    // paper.viewer_element.style.width = Math.round(w * paper.zoom_factor) + "px";
    // paper.viewer_element.style.height = Math.round(h * paper.zoom_factor) + "px";

}

// paper.offsetZoom=function(offsetFactor)
// {
//     paper.setZoom(paper.zoom_factor+offsetFactor);
// }

paper.offsetPan = function (x, y) {

    if (x == 0 && y == 0)
        return;

    //snap
    // if (paper.viewer_element.parentNode.scrollLeft + x < 1)
    //     paper.viewer_element.parentNode.scrollLeft = 0;
    // else
    //     paper.viewer_element.parentNode.scrollLeft += x;
    //
    //
    // if (paper.viewer_element.parentNode.scrollTop + y < 1)
    //     paper.viewer_element.parentNode.scrollTop =0;
    // else
    //     paper.viewer_element.parentNode.scrollTop += y;



    paper.scrollLeft += x;
    paper.scrollTop += y;
    paper.panning=true;

    // console.log(paper.scrollTop, paper.scrollLeft);
    paper.velocityX = 0;
    paper.velocityY = 0;

}

//in pixel/ms
paper.setPanVelocity = function (x, y) {

    paper.velocityX = x * 17; //1000ms/60fps
    paper.velocityY = y * 17;
    paper.panning=true;
}

//x and y are the center of the zoom
paper.setZoom = function (factor, x, y) {

    const diff = (factor - paper.zoom_update_factor);
    if (diff == 0)
        return;

    paper.zoom_update_factor=factor;
    paper.zoom_x=x;
    paper.zoom_y=y;


}


//send a "delete" (archive) for specified target element
paper.sendDeleteElement = function (target) {
    const matches = target.id.match(/c(\d*)o(\d*)/);
    if (matches) {
        const client_id = matches[1];
        const object_id = matches[2];
        paper.sendDrawIncrement(event.IncrementalType.Archive, client_id, object_id);
    }
}

