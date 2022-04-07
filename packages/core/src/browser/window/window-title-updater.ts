// *****************************************************************************
// Copyright (C) 2022 TypeFox and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
// *****************************************************************************

import { Widget } from '../widgets';
import { FrontendApplication, FrontendApplicationContribution } from '../frontend-application';
import { NavigatableWidget } from '../navigatable-types';
import { inject, injectable } from 'inversify';
import { WindowTitleService } from './window-title-service';
import { LabelProvider } from '../label-provider';
import { Event } from '../../common/event';

@injectable()
export class WindowTitleUpdater implements FrontendApplicationContribution {

    @inject(WindowTitleService)
    protected readonly windowTitleService: WindowTitleService;

    @inject(LabelProvider)
    protected readonly labelProvider: LabelProvider;

    onStart(app: FrontendApplication): void {
        Event.combine<unknown>(
            app.shell.onDidChangeActiveWidget,
            app.shell.onDidAddWidget
        )(() => {
            this.updateTitleWidget(app.shell.getCurrentWidget('main'));
        });
        app.shell.onDidRemoveWidget(widget => {
            const mainAreaWidget = app.shell.getCurrentWidget('main');
            this.updateTitleWidget(mainAreaWidget === widget ? undefined : mainAreaWidget);
        });
    }

    protected updateTitleWidget(widget?: Widget): void {
        let activeEditorLong: string | undefined;
        let activeEditorMedium: string | undefined;
        let activeEditorShort: string | undefined;
        let activeFolderLong: string | undefined;
        let activeFolderMedium: string | undefined;
        let activeFolderShort: string | undefined;
        const uri = NavigatableWidget.getUri(widget);
        if (uri) {
            activeEditorLong = uri.path.toString();
            activeEditorMedium = this.labelProvider.getLongName(uri);
            activeEditorShort = this.labelProvider.getName(uri);
            const parent = uri.parent;
            activeFolderLong = parent.path.toString();
            activeFolderMedium = this.labelProvider.getLongName(parent);
            activeFolderShort = this.labelProvider.getName(parent);
        } else if (widget) {
            const widgetTitle = widget.title.label;
            activeEditorLong = widgetTitle;
            activeEditorMedium = widgetTitle;
            activeEditorShort = widgetTitle;
        }
        this.windowTitleService.update({
            activeEditorLong,
            activeEditorMedium,
            activeEditorShort,
            activeFolderLong,
            activeFolderMedium,
            activeFolderShort
        });
    }

}
