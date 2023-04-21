import NodeCache from 'node-cache';
import { getPlayers, getQuests } from '../../infrastructure/data/googleSheet';
import { Player } from '../../typings/player';
import { Quest } from '../../typings/quest';

class GameDataService {
    private cache: NodeCache;

    constructor() {
        this.cache = new NodeCache();
    }

    async getPlayers(): Promise<Player[]> {
        let players = this.cache.get('players') as Player[] | null;
        if (players) {
            return players;
        }
        players = await getPlayers();
        this.cache.set('players', players, 120);
        return players;
    }

    async getQuests(getAllQuests = true): Promise<Quest[]> {
        let quests = this.cache.get('quests') as Quest[] | null;
        if (!quests) {
            quests = await getQuests();
            this.cache.set('quests', quests, 120);
        }

        if (!getAllQuests) {
            return quests.filter(
                (q) => q.state && q.state.toLowerCase().includes('fertig')
            );
        }
        return quests;
    }
}

export default GameDataService;
