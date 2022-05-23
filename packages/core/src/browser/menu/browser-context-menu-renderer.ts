// *****************************************************************************
// Copyright (C) 2017 TypeFox and others.
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { inject, injectable } from 'inversify';
import { Menu } from '../widgets';
import { ContextMenuAccess, ContextMenuRenderer, coordinateFromAnchor, RenderContextMenuOptions } from '../context-menu-renderer';
import { BrowserMainMenuFactory } from './browser-menu-plugin';
import { ColorTheme, CssStyleCollector, StylingParticipant } from '../styling-service';
import { isHighContrast } from '../theming';

export class BrowserContextMenuAccess extends ContextMenuAccess {
    constructor(
        public readonly menu: Menu
    ) {
        super(menu);
    }
}

@injectable()
export class BrowserContextMenuRenderer extends ContextMenuRenderer implements StylingParticipant {

    constructor(@inject(BrowserMainMenuFactory) private menuFactory: BrowserMainMenuFactory) {
        super();
    }

    protected doRender({ menuPath, anchor, args, onHide }: RenderContextMenuOptions): ContextMenuAccess {
        const contextMenu = this.menuFactory.createContextMenu(menuPath, args);
        const { x, y } = coordinateFromAnchor(anchor);
        if (onHide) {
            contextMenu.aboutToClose.connect(() => onHide!());
        }
        contextMenu.open(x, y);
        return new BrowserContextMenuAccess(contextMenu);
    }

    registerThemeStyle(theme: ColorTheme, collector: CssStyleCollector): void {
        const focusBorder = theme.getColor('focusBorder');
        if (focusBorder && isHighContrast(theme.type)) {
            collector.addRule(`.p-Menu .p-Menu-item:hover {
                outline: 1px solid ${focusBorder};
            }`);
        }
    }

}
