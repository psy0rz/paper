//
// Created by psy on 25-08-20.
//

#ifndef messages_SHAREDPAPER_H
#define messages_SHAREDPAPER_H


#include "messages/SharedSession.h"
#include <fstream>
#include <queue>
#include <condition_variable>


#include "MsgSessionPaper.h"

class SharedSessionPaper : public SharedSession {
private:
    MsgBuilder msg_builder_broadcast; //to send to clients
    MsgBuilder msg_builder_storage; //to send to storage module (without cursors and non-store increments)
    std::mutex msg_builder_mutex;

    std::fstream fs;

    void send_frame();


public:
    explicit SharedSessionPaper(const std::string &id);

    //basic joining/leaving/drawing stuff
    void join(std::shared_ptr<MsgSession> new_msg_session) override;
    void leave(std::shared_ptr<MsgSession> msg_session) override;

    //Add draw event to the broadcast buffer and store to disk (if necessary)
    //Events will only be broadcasted to clients that are synced (vs streaming a drawing from disk)
    void addDraw(const event::DrawIncrement* draw_increment);
    void addDraw(const event::DrawObject* draw_object);


    inline static bool stop=false;

    //global thread sends collected messages to all clients at 60fps
    static void update_thread();

    //global thread that calls storage stuff. (storing/streaming)
    static void io_thread();
    inline static std::queue<std::shared_ptr<MsgSessionPaper>> need_data_sessions;
    inline static std::mutex need_data_sessions_mutex;
    inline static std::condition_variable need_data_sessions_cv;
    static void request_data(const  std::shared_ptr<MsgSessionPaper> & msg_session_paper);
    static void stream_all();
    static void store_all();

    //called by io_thread when needed
    void store(const std::shared_ptr<MsgSessionPaper> &end_msg_session_paper=nullptr);
    void stream(const std::shared_ptr<MsgSessionPaper> &msg_session_paper);


};


#endif //messages_SHAREDPAPER_H
