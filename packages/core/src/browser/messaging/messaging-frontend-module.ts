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

import { ContainerModule } from 'inversify';
import { DefaultRpcProxyProvider } from '../../common/rpc';
import { BackendAndFrontend, ConnectionProvider, ProxyProvider } from '../../common';
import { SocketIoConnectionProvider } from './socket-io-connection-provider';
import { JSON_RPC_ROUTE } from '../../common/json-rpc-protocol';
import { JsonRpc } from '../../common/json-rpc';

export const messagingFrontendModule = new ContainerModule(bind => {
    bind(ProxyProvider)
        .toDynamicValue(ctx => {
            const jsonRpc = ctx.container.get(JsonRpc);
            const proxyProvider = ctx.container.get(DefaultRpcProxyProvider);
            const connectionProvider = ctx.container.getNamed(ConnectionProvider, BackendAndFrontend);
            return proxyProvider.initialize(serviceId => {
                const path = JSON_RPC_ROUTE.reverse({ serviceId });
                const connection = connectionProvider.open({ path });
                const messageConnection = jsonRpc.createMessageConnection(connection);
                return jsonRpc.createRpcConnection(messageConnection);
            });
        })
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
    bind(ConnectionProvider)
        .to(SocketIoConnectionProvider)
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
});
