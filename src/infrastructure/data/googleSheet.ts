import { google } from 'googleapis';
import { Player } from '../../typings/player';
import credentials from '../../keys/sheets-service-account.json';
import config from 'config';
import { Quest } from '../../typings/quest';

const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

function split(s: string): string[] {
    if(!s) {
        return [];
    }

    return s.split(',').filter(s => !!s).map(s.trim);
}

async function loadData(range: string) : Promise<any[][] | null | undefined> {
    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: scopes,
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: config.get('spreadsheetId'),
        range: range,
    });
    if(!res || !res.data) {
        return null;
    }
    return res.data.values;
}

async function getPlayers(): Promise<Player[]> {
    let rows = await loadData('Player!A:F');

    if (!rows || rows.length < 2) {
        console.log('No data found.');
        return [];
    }
    rows = rows.slice(1);
    console.log(`Loading ${rows.length} rows.`);

    const result: Player[] = [];
    for (const row of rows) {
        const player: Player = {
            id: row[0],
            homeOffice: row[1],
            aisle: row[2],
            phase: row[3],
            questsComplete: split(row[4]),
            questsActive: split(row[5]),
        };
        result.push(player);
    }

    return result;
}

async function getQuests(): Promise<Quest[]> {
    const rows = await loadData('Quests');
    console.log(rows);
    return [];
}

export { getPlayers, getQuests };
