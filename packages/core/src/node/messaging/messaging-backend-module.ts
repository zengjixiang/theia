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
import {
    BackendAndFrontend,
    bindServiceProvider, ConnectionHandler, ConnectionMultiplexer, ConnectionRouter,
    ProxyProvider,
    Rpc,
    ServiceProvider
} from '../../common';
import { AnyConnection, DeferredConnectionFactory } from '../../common/connection';
import { ContainerScopeReady, ContainerScopeRegistry, DefaultContainerScopeRegistry } from '../../common/container-scope';
import { collectRecursive, getAllNamedOptional } from '../../common/inversify-utils';
import { BackendApplicationContribution } from '../backend-application';
import { SocketIoServer } from '../socket-io-server';
import { DefaultRpcProxyProvider } from '../../common/rpc';
import { JSON_RPC_ROUTE } from '../../common/json-rpc-protocol';
import { FrontendServiceConnectionProvider } from './frontend-service-connection-provider';
import { DefaultConnectionMultiplexer } from '../../common/connection-multiplexer';
import { DefaultRouter, Router } from '../../common/routing';
import { JsonRpc } from '../../common/json-rpc';

export const BackendAndFrontendContainerScopeModule = new ContainerModule(bind => {
    bindServiceProvider(bind, BackendAndFrontend);
    bind(ConnectionRouter)
        .toDynamicValue(ctx => {
            const router = ctx.container.get<DefaultRouter<AnyConnection>>(DefaultRouter);
            collectRecursive(ctx.container, container => getAllNamedOptional(container, ConnectionHandler, BackendAndFrontend))
                .forEach(handler => router.listen(handler));
            return router;
        })
        .inSingletonScope();
    bind(ConnectionMultiplexer)
        .toDynamicValue(ctx => {
            const backendProxyingService = ctx.container.get(FrontendServiceConnectionProvider);
            const deferredConnectionFactory = ctx.container.get(DeferredConnectionFactory);
            return ctx.container.get(DefaultConnectionMultiplexer).initialize(deferredConnectionFactory(backendProxyingService.backendProxyingConnection));
        })
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
    // This proxy provider will run JSON-RPC over the frontend service connection
    bind(ProxyProvider)
        .toDynamicValue(ctx => {
            const jsonRpc = ctx.container.get(JsonRpc);
            const proxyProvider = ctx.container.get(DefaultRpcProxyProvider);
            const connectionProvider = ctx.container.getNamed(ConnectionMultiplexer, BackendAndFrontend);
            return proxyProvider.initialize(serviceId => {
                const path = JSON_RPC_ROUTE.reverse({ serviceId });
                const connection = connectionProvider.open({ path });
                const messageConnection = jsonRpc.createMessageConnection(connection);
                return jsonRpc.createRpcConnection(messageConnection);
            });
        })
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
    bind(FrontendServiceConnectionProvider).toSelf().inSingletonScope();
    // Service connection handler
    bind(ConnectionHandler)
        .toDynamicValue(ctx => ctx.container.get(FrontendServiceConnectionProvider).createConnectionHandler())
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
    // JSON-RPC connection handler
    bind(ConnectionHandler)
        .toDynamicValue(ctx => {
            const serviceProvider = ctx.container.getNamed(ServiceProvider, BackendAndFrontend);
            const jsonRpc = ctx.container.get(JsonRpc);
            const rpcProxying = ctx.container.get(Rpc);
            return ({ path }, accept, next) => {
                if (typeof path !== 'string') {
                    return next();
                }
                const match = JSON_RPC_ROUTE.match(path);
                if (!match) {
                    return next();
                }
                const [service, dispose] = serviceProvider.getService(match.serviceId);
                if (!service) {
                    return next();
                }
                const messageConnection = jsonRpc.createMessageConnection(accept());
                const rpcConnection = jsonRpc.createRpcConnection(messageConnection);
                rpcProxying.serve(service, rpcConnection);
                rpcConnection.onClose(dispose);
            };
        })
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
});

export const messagingBackendModule = new ContainerModule(bind => {
    // #region transients
    bind(SocketIoServer).toSelf().inTransientScope();
    // #endregion
    // #region BackendAndFrontend
    bind(BackendApplicationContribution)
        .toDynamicValue(ctx => ({
            onStart(httpServer): void {
                const router = ctx.container.getNamed(ConnectionRouter, BackendAndFrontend);
                ctx.container.get(SocketIoServer).initialize(httpServer, router, {
                    middlewares: [
                        (socket, next) => {
                            next();
                            if (socket.request.headers.origin) {
                                // next();
                            } else {
                                // next(new Error('invalid connection'));
                            }
                        }
                    ]
                });
            }
        }))
        .inSingletonScope();
    bind(ConnectionRouter)
        .toDynamicValue(ctx => {
            const router = ctx.container.get<DefaultRouter<AnyConnection>>(DefaultRouter);
            const scopes = ctx.container.getNamed(ContainerScopeRegistry, BackendAndFrontend);
            // first routing to find the Inversify container scope for `frontendId`
            router.listen(({ frontendId, ...params }, accept, next) => {
                if (!frontendId) {
                    return next();
                }
                const scope = scopes.getOrCreateScope(frontendId);
                // second routing to dispatch the incoming connection to scoped services
                scope.ref().container().get<Router<AnyConnection>>(ConnectionRouter).route(params, () => {
                    const connection = accept();
                    connection.onClose(() => scope.dispose());
                    return connection;
                }, next);
            });
            return router;
        })
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
    bind(ContainerScopeRegistry)
        .toDynamicValue(ctx => ctx.container.get(DefaultContainerScopeRegistry).initialize(
            // containerFactory
            () => {
                const modules = getAllNamedOptional(ctx.container, ContainerModule, BackendAndFrontend);
                const child = ctx.container.createChild();
                child.load(...modules);
                return child;
            },
            // getCallbacks
            container => getAllNamedOptional(container, ContainerScopeReady, BackendAndFrontend)
        ))
        .inSingletonScope()
        .whenTargetNamed(BackendAndFrontend);
    bind(ContainerModule)
        .toConstantValue(BackendAndFrontendContainerScopeModule)
        .whenTargetNamed(BackendAndFrontend);
    // #endregion
});
