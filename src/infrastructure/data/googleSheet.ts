import { google } from 'googleapis';
import { Player } from '../../typings/player';
import credentials from '../../keys/sheets-service-account.json';
import config from 'config';
import { Quest, QuestStage } from '../../typings/quest';

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
    let rows = await loadData('Quests');
    if (!rows || rows.length < 2) {
        console.log('No data found.');
        return [];
    }
    const result: Quest[] = [];
    rows = rows.slice(1);
    for (const row of rows) {
        const quest: Quest = {
            id: row[0],
            subNumber: readSubNumber(row[1]),
            cooldownTimeMinutes: row[8],
            description: row[4],
            name: row[3],
            parallel: row[7] && row[7].toLowerCase().includes('y'),
            phase: readIntArray(row[5]),
            repeatable: row[6] && row[6].toLowerCase().includes('y'),
            stages: [],
            state: row[2],
        };
        for(let colIdx = 9; colIdx < row.length - 6; colIdx += 7) {
            const stage: QuestStage = {
                triggerType: row[colIdx],
                triggerIds: readStringArray(row[colIdx + 1]),
                nonTriggerIds: readStringArray(row[colIdx + 2]),
                name: row[colIdx + 4],
                text: row[colIdx + 3],
                backupTimeSeconds: parseInt(row[colIdx + 5]),
                backupTextId: row[colIdx + 6],
            };
            quest.stages.push(stage);
        }
        result.push(quest);
    }
    return result;
}

function readStringArray(val: any) {
    if(!val) {
        return [];
    }

    return val.split(',').map((s: string) => s.trim());
}

function readIntArray(val: any) {
    if(!val) {
        return [];
    }

    if(typeof val === 'number') {
        return [val];
    }

    return val.split(',').filter((v: string) => !!v).map((x: string) => parseInt(x, 10)).filter((n: number) => !isNaN(n));
}

function readSubNumber(val: string) {
    if(!val) {
        return 0;
    }
    const parts = val.split('.');
    if(parts.length > 1) {
        const intValue = parseInt(parts[1]);
        if(isNaN(intValue)) {
            return 0;
        }
        return intValue;
    }

    return 0;
}

export { getPlayers, getQuests };
