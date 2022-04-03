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

import { Disposable, Owned } from './disposable';
import { Emitter, Event } from './event';
import { serviceIdentifier } from './types';

export const RcFactory = serviceIdentifier<RcFactory>('RcFactory');
/**
 * @param disposeCallback called when the reference count reaches 0.
 * You can take control of when {@link T} actually gets disposed.
 */
export type RcFactory = <T extends Disposable>(ref: T, disposeCallback?: RcDisposeCallback) => Rc<T>;
export type RcDisposeCallback = (dispose: () => void) => RcReviveCallback | void;
export type RcReviveCallback = () => void;

/**
 * This is a disposable reference counter to some underlying disposable instance.
 *
 * Call `.clone()` to create a new reference (increasing the reference count).
 *
 * The underlying resource will be disposed once all references are disposed.
 */
export interface Rc<T extends Disposable> extends Disposable {
    /**
     * Get a reference to the wrapped `T`.
     * @note You should not call dispose on the returned value.
     * @throws If `T` was disposed.
     */
    ref(): Owned<T>;
    /**
     * Create a new `Rc<T>` instance referencing the same `T` instance,
     * incrementing the reference count by 1.
     * @throws If `T` was disposed.
     */
    clone(): Rc<T>
    /**
     * Decrement the reference count by 1.
     * @note Calling `dispose` more than once does nothing.
     */
    dispose(): void
    /**
     * Is this specific `Rc<T>` instance disposed.
     */
    isDisposed(): boolean
    /**
     * Is `T` disposed. If `true` it means all `Rc<T>` were also disposed.
     */
    isRefDisposed(): this is never
    /**
     * Event emitted once all `Rc<T>` are disposed and we are about to dispose
     * the underlying `T` instance.
     */
    onWillDisposeRef: Event<Owned<T>>
}
export namespace Rc {
    export enum Errors {
        RC_DISPOSED = 'this reference is disposed',
        REF_DISPOSED = 'the underlying reference is disposed'
    }
}

/**
 * @internal
 */
export interface DefaultRcState<T extends Disposable> {
    disposeCallback?: RcDisposeCallback
    reviveCallback?: RcReviveCallback
    onWillDisposeReferenceEmitter: Emitter<T>
    count: number
    ref?: T
}

/**
 * @internal
 */
export class DefaultRc<T extends Disposable> implements Rc<T> {

    static New<T extends Disposable>(ref: T, disposeCallback?: RcDisposeCallback): Rc<T> {
        return new this({
            ref,
            count: 0,
            onWillDisposeReferenceEmitter: new Emitter<T>(),
            disposeCallback
        });
    }

    protected disposed = false;

    protected constructor(
        protected state: DefaultRcState<T>
    ) {
        this.state.count += 1;
        if (this.state.count === 1 && this.state.reviveCallback) {
            this.state.reviveCallback();
            this.state.reviveCallback = undefined;
        }
    }

    get onWillDisposeRef(): Event<T> {
        if (this.isRefDisposed()) {
            return Event.None;
        }
        return this.state.onWillDisposeReferenceEmitter.event;
    }

    ref(): T {
        if (this.isRefDisposed()) {
            throw new Error(Rc.Errors.REF_DISPOSED);
        }
        if (this.isDisposed()) {
            console.trace(Rc.Errors.RC_DISPOSED);
        }
        return this.state.ref!;
    }

    clone(): Rc<T> {
        if (this.isRefDisposed()) {
            throw new Error(Rc.Errors.REF_DISPOSED);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return new (this.constructor as any)(this.state!);
    }

    dispose(): void {
        if (this.isDisposed()) {
            console.trace(Rc.Errors.RC_DISPOSED);
            return;
        }
        this.disposed = true;
        this.state.count -= 1;
        if (this.state.count === 0) {
            if (this.state.disposeCallback) {
                const result = this.state.disposeCallback(() => {
                    if (this.state.count === 0) {
                        this.disposeRef();
                    }
                });
                if (typeof result === 'function') {
                    this.state.reviveCallback = result;
                }
            } else {
                this.disposeRef();
            }
        }
    }

    isDisposed(): boolean {
        return this.disposed;
    }

    isRefDisposed(): this is never {
        return this.state.ref === undefined;
    }

    protected disposeRef(): void {
        this.state.onWillDisposeReferenceEmitter.fire(this.state.ref!);
        this.state.onWillDisposeReferenceEmitter.dispose();
        this.state.ref!.dispose();
        this.state.ref = undefined;
    }
}
