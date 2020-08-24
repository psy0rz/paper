#ifndef SHARED_SESSION_HPP
#define SHARED_SESSION_HPP

// #include <map>
// #include <mutex>
// #include <chrono>
// #include <string>
// #include <memory>
// #include <random>
// #include <cstdlib>
#include "msg_session.hpp"

// class MsgSession;

class SharedSession
{
private:
  // all the shared sessions (static/global)
  inline static std::mutex shared_sessions_lock;
  inline static std::map<std::string, std::weak_ptr<SharedSession>> shared_sessions;

  std::string id;

  // sessions that are joined to this shared session
  std::mutex msg_sessions_lock;
  std::vector<std::weak_ptr<MsgSession>> msg_sessions;

public:
  SharedSession(const std::string& id)
  {
    this->id = id;
    DEB("Created shared session " << id);
  }

  ~SharedSession(void) { DEB("Destroyed shared session " << id); }

  // get/create a shared session by id-string
  static std::shared_ptr<SharedSession> get(const std::string & id)
  {
    std::unique_lock<std::mutex> lock(SharedSession::shared_sessions_lock);
    auto existing_shared_session = SharedSession::shared_sessions.find(id);

    // session doesnt exist (anymore)?
    if (existing_shared_session == SharedSession::shared_sessions.end() ||
        existing_shared_session->second.expired()) {
      // create new shared session
      auto new_shared_session = std::make_shared<SharedSession>(id);
      SharedSession::shared_sessions[id] = new_shared_session;
      return (new_shared_session);

    } else {
      // return existing
      return (SharedSession::shared_sessions[id].lock());
    }
  }

  // send to all sessions
  void enqueue(msg_serialized_type& msg_serialized)
  {

    std::unique_lock<std::mutex> lock(msg_sessions_lock);

    for (auto& msg_session : msg_sessions) {
      auto msg_session_shared = msg_session.lock();
      if (msg_session_shared != nullptr) {
        msg_session_shared->enqueue(msg_serialized);
      }
    }
  }

  // let a session join this shared_session
  void join(std::weak_ptr<MsgSession> new_msg_session)
  {
    std::unique_lock<std::mutex> lock(msg_sessions_lock);

    // replace an expired session?
    for (auto& msg_session : msg_sessions) {
      if (msg_session.expired()) {
        msg_session = new_msg_session;
        return;
      }
    }

    msg_sessions.push_back(new_msg_session);
  }
};

#endif