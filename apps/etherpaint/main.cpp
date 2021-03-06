#include <messages/program_error.hpp>
#include "messages/messages.h"
#include "messages/register_handler.h"
#include "messages/inicpp.h"

#include "SharedSessionPaper.h"
#include "MsgSessionPaper.h"

//raises program error if something illegal going on
void validate_command(
        const std::shared_ptr<MsgSessionPaper> & msg_session_paper,
        const std::shared_ptr<SharedSessionPaper> & shared_session_paper,
        const uint8_t clientId)
{
    //has no client id yet.
    if ( !msg_session_paper->id )
        throw (program_error("Client doesn't have an ID yet."));

    if (clientId != msg_session_paper->id)
        throw (program_error("Sent invalid client id."));

    if (shared_session_paper == nullptr)
        throw (program_error("Client hasn't joined a paper yet."));
}


//Generic function template to create EVENT and call appropriate SharedSessionPaper::addDraw() overload.
//Does all necessary validation against malicious input.
template<typename EVENT>
void addDraw(const std::shared_ptr<MsgSession> &msg_session, const msg_type &msg,
             const flatbuffers::uoffset_t &event_index) {

    const auto &msg_session_paper = std::static_pointer_cast<MsgSessionPaper>(msg_session);
    const auto &shared_session_paper = std::static_pointer_cast<SharedSessionPaper>(msg_session_paper->shared_session);
    const auto event = msg->events()->GetAs<EVENT>(event_index);

    validate_command(msg_session_paper, shared_session_paper, event->clientId());
    shared_session_paper->addDraw(event);

};

bool load_config(ini::IniFile & config, std::string config_file) {
    INFO("Loading config from: " << config_file)
    std::ifstream is(config_file);
    if (is.fail()) {
        ERROR("Error opening " << config_file);
        return (false);
    }
    config.decode(is);

    return(true);
}


int main(const int argc, const char *argv[]) {

    /////////////////////////// assign event handlers

    //Join
    handlers[event::EventUnion_Join] = [](const std::shared_ptr<MsgSession> &msg_session, const msg_type &msg,
                                          auto event_index) {
        auto event = msg->events()->GetAs<event::Join>(event_index);

        msg_session->join(event->id()->str());


    };

    //Cursor update received
    handlers[event::EventUnion_Cursor] = [](const std::shared_ptr<MsgSession> &msg_session, const msg_type &msg,
                                            auto event_index) {
        const auto &msg_session_paper = std::static_pointer_cast<MsgSessionPaper>(msg_session);
        const auto &shared_session_paper = std::static_pointer_cast<SharedSessionPaper>(msg_session_paper->shared_session);
        const auto event = msg->events()->GetAs<event::Cursor>(event_index);

        validate_command(msg_session_paper, shared_session_paper, event->clientId());

        //not thread safe but shouldnt matter for cursors?
        msg_session_paper->cursor = *event;
        msg_session_paper->cursor_changed = true;

    };

    //actual drawing events:
    handlers[event::EventUnion_DrawIncrement] = addDraw<event::DrawIncrement>;
    handlers[event::EventUnion_DrawObject] = addDraw<event::DrawObject>;

    /////////////////////////////////////////// main code

    if (argc != 2) {
        ERROR("Usage: " << argv[0] << " <config.ini>");
        return (-1);
    }

    //parse config
    ini::IniFile config;
    if (!load_config(config, argv[1]))
        return(-1);


    //start our threads
    std::thread update_thread(SharedSessionPaper::update_thread);
    std::thread io_thread(SharedSessionPaper::io_thread);

    //run the main uwebsocket event-framework (messages.cpp)
    message_server(config);

    //wait for completion
    update_thread.join();
    io_thread.join();

}



