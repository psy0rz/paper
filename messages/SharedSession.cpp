#include "SharedSession.h"

SharedSession::SharedSession(const std::string &id) {
    this->id = id;
    DEB("Created shared session " << id);
}

std::shared_ptr<SharedSession> SharedSession::get(const std::string &id) {
    std::unique_lock<std::mutex> lock(SharedSession::shared_sessions_lock);
    auto existing_shared_session = SharedSession::shared_sessions.find(id);

    // session doesnt exist (anymore)?
    if (existing_shared_session == SharedSession::shared_sessions.end())  {
        // create new shared session
        auto new_shared_session = SharedSession::create(id);
        SharedSession::shared_sessions[id] = new_shared_session;
        return (new_shared_session);

    } else {
        // return existing
        return (SharedSession::shared_sessions[id]);
    }
}

void SharedSession::done(const std::string &id) {
    std::unique_lock<std::mutex> lock(SharedSession::shared_sessions_lock);
    SharedSession::shared_sessions.erase(id);
}



void SharedSession::enqueue(msg_serialized_type &msg_serialized) {

    std::unique_lock<std::mutex> lock(msg_sessions_lock);

    for (auto &msg_session : msg_sessions) {
//        auto msg_session_shared_ptr = msg_session.lock();
        msg_session->enqueue(msg_serialized);
    }
}

void SharedSession::join(std::shared_ptr<MsgSession> new_msg_session) {
    std::unique_lock<std::mutex> lock(msg_sessions_lock);

    DEB("Joined shared session " << id);
    msg_sessions.insert(new_msg_session);
}

void SharedSession::leave(std::shared_ptr<MsgSession> msg_session) {
    std::unique_lock<std::mutex> lock(msg_sessions_lock);
    DEB("left shared session " << id);
    msg_sessions.erase(msg_session);
    if (msg_sessions.empty())
        SharedSession::done(id);
}


