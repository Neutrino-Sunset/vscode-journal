// Copyright (C) 2021  Patrick Maué
// 
// This file is part of vscode-journal.
// 
// vscode-journal is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// vscode-journal is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with vscode-journal.  If not, see <http://www.gnu.org/licenses/>.
// 
'use strict';

import * as vscode from 'vscode';
import * as J from '../..';
import { NoteInput, SelectedInput } from '../../model';

type RegExpMatchArrayWithIndices = RegExpMatchArray & { indices: Array<[number, number]> };

export class AbstractLoadEntryForDateCommand implements vscode.Disposable {

    protected constructor(public ctrl: J.Util.Ctrl) { }

    public async dispose(): Promise<void> {
        // do nothing
    }

    /**
     * Implements commands "yesterday", "today", "yesterday", where the input is predefined (no input box appears)
     * @param offset 
     */
    public async execute(input: J.Model.Input): Promise<void> {

        try {
            const doc = await this.loadPageForInput(input);
            await this.ctrl.ui.showDocument(doc);
        } catch (error) {
            if (error !== 'cancel') {
                this.ctrl.logger.error("Failed to load entry for input: ", input.text, "Reason: ", error);
                this.ctrl.ui.showError("Failed to open entry.");
            } else { return; }
        }
    }



    /**
     * Expects any user input from the magic input and either opens the file or creates it. 
     * @param input 
     */
    protected async loadPageForInput(input: J.Model.Input): Promise<vscode.TextDocument> {

        if (input instanceof SelectedInput) {
            // we just load the path
            return this.ctrl.ui.openDocument((<SelectedInput>input).path);
        } if (input instanceof NoteInput) {
            // we create or load the notes
            this.adjustNoteDateToLastMonday(input);
            return new J.Provider.LoadNotes(input, this.ctrl).loadWithPath(input.path);
        } else {
            return this.ctrl.reader.loadEntryForInput(input)
                .then((doc: vscode.TextDocument) => this.ctrl.inject.injectInput(doc, input));
        }
    }

    private adjustNoteDateToLastMonday(input: J.Model.NoteInput) {

        const pathDate = this.getDateComponentsFromPath(input.path);
        if (pathDate === null) {
            return;
        }

        // Get the date of last Monday.
        const day = pathDate.date.getDay();
        const daysToSubtract = day === 0 ? 6 : day - 1; // Convert the day of week to start on Monday.
        const msPerDay = 24 * 60 * 60 * 1000;
        // TODO: This calculation does not take account of daylight savings change days.
        const newDateMs = pathDate.date.valueOf() - (daysToSubtract * msPerDay);
        const newDateObj = new Date(newDateMs);

        // Construct a new path adjusted to last Monday.
        const oldPath = input.path;
        const newYear = newDateObj.getFullYear().toString();
        const newMonth = (newDateObj.getMonth() + 1).toString().padStart(2, "0");
        const newDate = newDateObj.getDate().toString().padStart(2, "0");
        let newPath = this.replaceAt(oldPath, newYear, pathDate.indexes[0]);
        newPath = this.replaceAt(newPath, newMonth, pathDate.indexes[1]);
        newPath = this.replaceAt(newPath, newDate, pathDate.indexes[2]);

        // Update the input.
        input.path = newPath;
        input.offset = 0 - daysToSubtract; // Warning: '-daysToSubtract' could be negative zero, don't go there!
    }

    /**
     * Extracts the year, month and date from a path and returns them as a Date object.
     * The position of each date component in the path is returned in a corresponding indexes array.
     * Returns null if no date is located in the path.
     */
    private getDateComponentsFromPath(path: string): { date: Date, indexes: number[] } | null {
        const regex = /\\(\d{4})\\(\d{2})\\(\d{2})\\/d;
        const match = path.match(regex) as RegExpMatchArrayWithIndices;
        if (match === null) {
            return null;
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const dayOfMonth = Number(match[3]);
        const date = new Date(year, month - 1, dayOfMonth);

        const indexes = [
            match.indices[1][0],
            match.indices[2][0],
            match.indices[3][0]
        ];

        return { date, indexes };
    }

    /**
     * Inserts the string 'insert' into the string 'source' at the position 'index' overwriting
     * the existing content at that location.
     */
    private replaceAt(source: string, insert: string, index: number): string {
        return source.slice(0, index) + insert + source.slice(index + insert.length);
    }
}
