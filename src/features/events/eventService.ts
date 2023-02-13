import { Event } from '../../typings/event';

class EventService {
    handleEvent = (event: Event): string => {
        console.log(event);
        if(typeof event.value === 'string') {
            return 'String OK';
        }
        return 'OK';
    };
}

export default EventService;
