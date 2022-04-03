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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { inject, injectable } from 'inversify';
import { Disposable, DisposableCollection } from './disposable';
import { CancellationToken } from './cancellation';
import { Emitter, Event } from './event';
import { Proxied, ProxyProvider } from './proxy';
import { Reflection } from './reflection';
import { NonArray, serviceIdentifier } from './types';
// import { Rc, RcFactory } from './reference-counter';

/**
 * Represents a scoped connection to a remote service on which to call methods.
 *
 * There should be a 1-to-1 relationship between a `RpcConnection` and the
 * remote service it represents.
 */
export const RpcConnection = serviceIdentifier<RpcConnection>('RpcConnection');
export interface RpcConnection {
    onClose: Event<void>
    handleRequest(handler: (method: string, params: any[], token: CancellationToken) => any): void
    handleNotification(handler: (method: string, params: any[]) => void): void
    sendRequest<T>(method: string, params: any[]): Promise<T>
    sendNotification(method: string, params: any[]): void
    /**
     * Terminate this `RpcConnection` and close the underlying connection.
     */
    close(): void
}

// export interface RpcConnectionTransformerCallbacks {
//     // incoming
//     transformIncomingResponseResult?(method: string, params: any[], result: any): any
//     transformIncomingResponseError?(method: string, params: any[], error: any): any
//     // outgoing
//     transformOutgoingResponseResult?(method: string, params: any[], result: any): any
//     transformOutgoingResponseError?(method: string, params: any[], error: any): any
// }

// export const RpcConnectionTransformer = serviceIdentifier<RpcConnectionTransformer>('RpcConnectionTransformer');
// export type RpcConnectionTransformer = (RpcConnection: RpcConnection, callbacks: RpcConnectionTransformerCallbacks) => RpcConnection;

export interface RpcServer {
    [key: string | symbol]: any
}

export type NotArray<T> = T extends any[] ? never : T;

/**
 * Methods to wire JavaScript {@link Proxy} instances over {@link RpcConnection}s.
 */
export const Rpc = serviceIdentifier<Rpc>('Rpc');
export interface Rpc {

    /**
     * Create a JS proxy that translates method calls into RPC requests.
     * Calling `proxy.dispose` will close the underlying connection,
     * you most likely want to use this on ephemeral proxies only!
     */
    createProxy<T>(rpcConnection: RpcConnection): Proxied<T>

    /**
     * Serve {@link rpcConnection} by calling methods on {@link server}.
     *
     * It will only "un-hook" events when the {@link rpcConnection} closes.
     */
    serve<T extends RpcServer>(server: NonArray<T>, rpcConnection: RpcConnection): void

    // /**
    //  * Serve {@link rpcConnection} by calling methods on {@link server}.
    //  *
    //  * It will try to dispose {@link instance} when the {@link rpcConnection} closes.
    //  *
    //  * If you called this method with the same {@link instance} multiple times,
    //  * it will only dispose of the instance once all attached connections are
    //  * closed.
    //  */
    // serveRc(instance: RpcServer & Disposable, rpcConnection: RpcConnection): void;
}

/**
 * @internal
 */
@injectable()
export class DefaultRpc implements Rpc {

    // protected rcs = new WeakMap<RpcServer, Rc<Disposable>>();

    // @inject(RcFactory)
    // protected rcFactory: RcFactory;

    @inject(Reflection)
    protected reflection: Reflection;

    createProxy<T>(rpcConnection: RpcConnection): Proxied<T> {
        // eslint-disable-next-line no-null/no-null
        const emptyObject = Object.freeze(Object.create(null));
        const rpcProxyHandler = new RpcProxyHandler(rpcConnection, this.reflection);
        return new Proxy(emptyObject, rpcProxyHandler);
    }

    serve(server: RpcServer, rpcConnection: RpcConnection): void {
        rpcConnection.handleRequest((method, params, token) => server[method](...params, token));
        const disposables = new DisposableCollection();
        this.reflection.getEventNames(server).forEach(eventName => {
            const event: Event<unknown> = server[eventName];
            event(value => rpcConnection.sendNotification(eventName, [value]), undefined, disposables);
        });
        rpcConnection.onClose(() => disposables.dispose());
    }

    // serveRc(instance: RpcServer & Disposable, rpcConnection: RpcConnection): void {
    //     let rc = this.rcs.get(instance);
    //     if (rc) {
    //         rc = rc.clone();
    //     } else {
    //         this.rcs.set(instance, rc = this.rcFactory(instance));
    //     }
    //     const disposables = new DisposableCollection(rc);
    //     rpcConnection.onRequest((method, params, token) => instance[method](...params, token));
    //     this.reflection.getEventNames(instance).forEach(eventName => {
    //         const event: Event<unknown> = instance[eventName];
    //         event(value => rpcConnection.sendNotification(eventName, [value]), undefined, disposables);
    //     });
    //     rpcConnection.onClose(() => disposables.dispose());
    // }
}

/**
 * @internal
 */
export type RpcConnectionProvider = (serviceId: string, serviceParams?: any) => RpcConnection;

/**
 * @internal
 */
@injectable()
export class DefaultRpcProxyProvider implements ProxyProvider {

    protected rpcConnectionProvider?: RpcConnectionProvider;
    protected connectionToProxyCache = new WeakMap<RpcConnection, any>();

    @inject(Rpc)
    protected rpcProxying: Rpc;

    initialize(rpcConnectionProvider: RpcConnectionProvider): ProxyProvider {
        this.rpcConnectionProvider = rpcConnectionProvider;
        return this;
    }

    getProxy(serviceId: string, params?: any): any {
        const rpcConnection = this.rpcConnectionProvider!(serviceId, params);
        let proxy = this.connectionToProxyCache.get(rpcConnection);
        if (!proxy) {
            this.connectionToProxyCache.set(rpcConnection, proxy = this.rpcProxying.createProxy(rpcConnection));
        }
        return proxy;
    }
}

/**
 * @internal
 */
export class RpcProxyHandler<T extends object> implements ProxyHandler<T>, Disposable {

    protected emitters = new Map<string, Emitter>();
    protected cache = new Map<string | symbol, any>();
    protected disposed = false;

    constructor(
        protected rpcConnection: RpcConnection,
        protected reflection: Reflection,
    ) {
        this.cache.set('dispose', () => {
            if (!this.disposed) {
                this.disposed = true;
                rpcConnection.close();
            }
        });
        rpcConnection.handleNotification((eventName, params) => {
            this.emitters.get(eventName)?.fire(params[0]);
        });
        rpcConnection.onClose(() => this.dispose());
    }

    get(target: T, property: string | symbol, receiver: T): any {
        if (this.disposed) {
            throw new Error('this instance is no longer valid!');
        }
        if (typeof property !== 'string') {
            throw new Error('you can only index this proxy with strings');
        }
        let returnValue = this.cache.get(property);
        if (!returnValue) {
            if (this.reflection.isEventName(property)) {
                const emitter = new Emitter();
                this.emitters.set(property, emitter);
                returnValue = emitter.event;
            } else {
                returnValue = async (...params: any[]) => this.rpcConnection.sendRequest(property, params);
            }
            this.cache.set(property, returnValue);
        }
        return returnValue;
    }

    dispose(): void {
        this.disposed = true;
        this.emitters.forEach(emitter => emitter.dispose());
        this.emitters.clear();
        this.cache.clear();
    }
}

// export class DefaultRpcConnectionTransformer implements RpcConnection {

//     constructor(
//         protected rpcConnection: RpcConnection,
//         protected callbacks: RpcConnectionTransformerCallbacks
//     ) { }

//     get onClose(): Event<void> {
//         return this.rpcConnection.onClose;
//     }

//     handleNotification(handler: (method: string, params: any[]) => void): void {
//         return this.rpcConnection.handleNotification(handler);
//     }

//     handleRequest(handler: (method: string, params: any[], token: CancellationToken) => any): void {
//         return this.rpcConnection.handleRequest((method, params, token) => Promise.resolve(handler(method, params, token)).then(
//             result => this.callbacks.transformOutgoingResponseResult?.(method, params, result) ?? result,
//             error => { throw this.callbacks.transformOutgoingResponseError?.(method, params, error) ?? error; }
//         ));
//     }

//     sendNotification(method: string, params: any[]): void {
//         this.rpcConnection.sendNotification(method, params);
//     }

//     sendRequest<T>(method: string, params: any[]): Promise<T> {
//         return this.rpcConnection.sendRequest(method, params).then(
//             result => this.callbacks.transformIncomingResponseResult?.(method, params, result) ?? result,
//             error => { throw this.callbacks.transformIncomingResponseError?.(method, params, error) ?? error; }
//         );
//     }

//     close(): void {
//         this.rpcConnection.close();
//     }
// }
