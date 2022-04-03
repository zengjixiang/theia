// *****************************************************************************
// Copyright (C) 2022 Ericsson and others.
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
import { DeferredConnection, DeferredConnectionFactory } from './connection';
import { DefaultConnectionMultiplexer } from './connection-multiplexer';
import { ConnectionTransformer, TransformedConnection } from './connection-transformer';
import { ContainerScopeFactory, DefaultContainerScope, DefaultContainerScopeRegistry } from './container-scope';
import { DefaultJsonRpc, JsonRpc } from './json-rpc';
import { LazyProxyFactory, LazyProxyHandler } from './proxy';
import { DefaultRc, RcFactory } from './reference-counter';
import { DefaultReflection, Reflection } from './reflection';
import { DefaultRouter } from './routing';
import { RouteHandlerProvider, DefaultRouteHandlerProvider } from './route-handler';
import { DefaultRpc, DefaultRpcProxyProvider, Rpc } from './rpc';

export default new ContainerModule(bind => {
    // #region transients
    bind(DefaultRouter).toSelf().inTransientScope();
    bind(DefaultConnectionMultiplexer).toSelf().inTransientScope();
    bind(DefaultRpcProxyProvider).toSelf().inTransientScope();
    bind(DefaultContainerScopeRegistry).toSelf().inTransientScope();
    // #endregion
    // #region singletons
    bind(JsonRpc).to(DefaultJsonRpc).inSingletonScope();
    bind(Rpc).to(DefaultRpc).inSingletonScope();
    bind(Reflection).to(DefaultReflection).inSingletonScope();
    bind(RouteHandlerProvider).to(DefaultRouteHandlerProvider).inSingletonScope();
    // #endregion
    // #region factories
    bind(ConnectionTransformer)
        .toFunction((connection, transformer) => new TransformedConnection(connection, transformer));
    bind(DeferredConnectionFactory)
        .toFunction(promise => new DeferredConnection(promise));
    bind(ContainerScopeFactory)
        .toFunction((container, callbacks) => new DefaultContainerScope(container, callbacks));
    bind(RcFactory)
        .toFunction(ref => DefaultRc.New(ref));
    bind(LazyProxyFactory)
        .toDynamicValue(ctx => promise => {
            // eslint-disable-next-line no-null/no-null
            const nullObject = Object.freeze(Object.create(null));
            const reflection = ctx.container.get(Reflection);
            const proxyHandler = new LazyProxyHandler(promise, reflection);
            return new Proxy(nullObject, proxyHandler);
        })
        .inSingletonScope();
    // #endregion
});
