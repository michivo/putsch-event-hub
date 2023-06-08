import NodeCache from 'node-cache';
import { getPlayers, getQuests } from '../../infrastructure/data/googleSheet';
import { Player } from '../../typings/player';
import { Quest } from '../../typings/quest';

class GameDataService {
    private cache: NodeCache;
    private lastPlayers: Player[] | undefined;
    private lastQuests: Quest[] | undefined;

    constructor() {
        this.cache = new NodeCache();
    }

    async getPlayers(): Promise<Player[]> {
        let players = this.cache.get('players') as Player[] | null;
        if (players) {
            this.lastPlayers = players;
            return players;
        }
        if (!this.lastPlayers) {
            players = await getPlayers();
            this.cache.set('players', players, 120);
            this.lastPlayers = players;
            return players;
        }

        this.refreshPlayers();
        return this.lastPlayers;
    }

    async getQuests(): Promise<Quest[]> {
        try {
            let quests = this.cache.get('quests') as Quest[] | null;
            if (!quests) {
                if (!this.lastQuests) {
                    quests = await getQuests();
                    this.cache.set('quests', quests, 120);
                    this.lastQuests = quests;
                    return quests;
                }
                else {
                    this.refreshQuests();
                    return this.lastQuests;
                }
            }
            else {
                this.lastQuests = quests;
                return quests;
            }
        }
        catch(error) {
            console.error('Error parsing quests:');
            console.error(error);
            throw error;
        }
    }

    async refreshPlayers() {
        const players = await getPlayers();
        this.cache.set('players', players, 120);
        this.lastPlayers = players;
    }

    async refreshQuests() {
        const quests = await getQuests();
        this.cache.set('quests', quests, 120);
        this.lastQuests = quests;
    }
}

export default GameDataService;
