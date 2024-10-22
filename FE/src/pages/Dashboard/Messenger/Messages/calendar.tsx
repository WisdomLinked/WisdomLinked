import React, { useState, useEffect } from "react";
import { Calendar } from "react-big-calendar";
import { localizer } from "../../../../actions/common";

const MessageCalendar = (props: any) => {

    const [events, set_events] = useState<Array<any>>([])

    const eventStyleGetter = (event: any, start: any, end: any) => {
        const now = new Date()
        const style = end < now ? {
            backgroundColor: '#000000',
            borderRadius: '0px',
            opacity: 0.7,
            color: event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red',
            // display: 'block',
            // 'pointer-events': 'none'
        } : {
            backgroundColor: event.status === 'accepted' ? '#31B099' : event.status === 'pending' ? '#a87723' : 'red',
            borderRadius: '0px',
            opacity: 1,
            color: 'white',
            border: '0px',
            // display: 'block',
        };
        return {
            style: style,
        };
    };

    useEffect(() => {
        let temp = props.events.map((event: any) => {
            return {
                ...event,
                id: event._id,
                start: new Date(event.start),
                end: new Date(event.end),
            }
        })
        set_events([...temp])
    }, [props.events])

    return (
        <Calendar
            className="customerSelectDateTimeCalendar !h-full min-h-[400px] text-white"
            views={["month", "week", "day", "agenda"]}
            selectable
            localizer={localizer}
            defaultDate={new Date()}
            defaultView="month"
            events={events || []}
            eventPropGetter={eventStyleGetter}
        />
    );
};

export default MessageCalendar;
