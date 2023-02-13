import { Greeting } from '../../typings/greeting';

class HealthService {
    sayHello = (name: string): Greeting => {
        return {
            message: `Hello ${name}! This is the Event Hub API, nice to see you!`,
        };
    };
}

export default HealthService;
