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

import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { ShellProcess, ShellProcessFactory, ShellProcessOptions } from './shell-process';
import { ITerminalServer, RemoteTerminalFactory, terminalPath, terminalsPath } from '../common/terminal-protocol';
import { IBaseTerminalServer, TerminalWatcher } from '../common/base-terminal-protocol';
import { TerminalServer } from './terminal-server';
import { IShellTerminalServer, shellTerminalPath } from '../common/shell-terminal-protocol';
import { ShellTerminalServer } from '../node/shell-terminal-server';
import { createCommonBindings } from '../common/terminal-common-module';
import { BackendAndFrontend, Event, ServiceContribution } from '@theia/core';
import { ProcessManager, TerminalProcess } from '@theia/process/lib/node';
import { RemoteTerminalImpl } from './remote-terminal-impl';

export const TerminalContainerModule = new ContainerModule(bind => {
    bind(ITerminalServer).to(TerminalServer).inSingletonScope();
    bind(IShellTerminalServer).to(ShellTerminalServer).inSingletonScope();
    bind(TerminalWatcher)
        .toDynamicValue(ctx => {
            const terminalServer = ctx.container.get(ITerminalServer);
            const shellServer = ctx.container.get(IShellTerminalServer);
            return {
                onTerminalError: Event.or(terminalServer.onTerminalError, shellServer.onTerminalError),
                onTerminalExitChanged: Event.or(terminalServer.onTerminalExitChanged, shellServer.onTerminalExitChanged)
            };
        })
        .inSingletonScope();
    bind(ServiceContribution)
        .toDynamicValue(ctx => {
            const remoteTerminalFactory = ctx.container.get(RemoteTerminalFactory);
            return ServiceContribution.record(
                [terminalPath, () => ctx.container.get(ITerminalServer)],
                [shellTerminalPath, () => ctx.container.get(IShellTerminalServer)],
                [terminalsPath, (params, lifecycle) => lifecycle.track(remoteTerminalFactory(params.terminalId))]
            );
        })
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
});

export default new ContainerModule(bind => {
    bind(ContainerModule).toConstantValue(TerminalContainerModule).whenTargetNamed(BackendAndFrontend);

    bind(ShellProcess).toSelf().inTransientScope();
    bind(ShellProcessFactory).toFactory(ctx => (options: ShellProcessOptions) => {
        const child = ctx.container.createChild();
        child.bind(ShellProcessOptions).toConstantValue(options);
        return child.get(ShellProcess);
    });

    bind(RemoteTerminalFactory)
        .toDynamicValue(ctx => {
            const processManager = ctx.container.get(ProcessManager);
            return terminalId => {
                const term = processManager.get(terminalId);
                if (term instanceof TerminalProcess) {
                    return new RemoteTerminalImpl(term);
                }
                throw new Error(`no terminal for id=${terminalId}`);
            };
        })
        .inSingletonScope();

    createCommonBindings(bind);
});

/**
 * @deprecated since 1.25.0
 */
export function bindTerminalServer(bind: interfaces.Bind, { path, identifier, constructor }: {
    path: string,
    identifier: interfaces.ServiceIdentifier<IBaseTerminalServer>,
    constructor: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new(...args: any[]): IBaseTerminalServer;
    }
}): void {
    bind<IBaseTerminalServer>(identifier).to(constructor).inSingletonScope();
    bind(ServiceContribution)
        .toDynamicValue(ctx => ServiceContribution.record(
            [path, () => ctx.container.get(identifier)]
        ))
        .inSingletonScope();
}
