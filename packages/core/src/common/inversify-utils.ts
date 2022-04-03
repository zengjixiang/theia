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

/* eslint-disable no-null/no-null */

import type { interfaces } from 'inversify';

export function getOptional<T>(container: interfaces.Container, serviceIdentifier: interfaces.ServiceIdentifier<T>): T | undefined {
    if (container.isBound(serviceIdentifier)) {
        return container.get(serviceIdentifier);
    }
}

export function getAllOptional<T>(container: interfaces.Container, serviceIdentifier: interfaces.ServiceIdentifier<T>): T[] {
    if (container.isBound(serviceIdentifier)) {
        return container.getAll(serviceIdentifier);
    }
    return [];
}

export function getAllNamedOptional<T>(container: interfaces.Container, serviceIdentifier: interfaces.ServiceIdentifier<T>, name: string | number | symbol): T[] {
    if (container.isBoundNamed(serviceIdentifier, name)) {
        return container.getAllNamed(serviceIdentifier, name);
    }
    return [];
}

/**
 * Go through the chain of parent containers while collecting bindings.
 * @note
 * It will disconnect the current container from its parent when calling
 * {@link collect} before reverting the change. We must do this otherwise
 * resolutions might be duplicated (e.g. once in the child that bubbled the
 * request to its parent, and once in the parent itself).
 */
export function collectRecursive<T>(container: interfaces.Container, collect: (container: interfaces.Container) => T[]): T[] {
    let result: T[] = [];
    let current: interfaces.Container | null = container;
    do {
        const parent: interfaces.Container | null = current.parent;
        current.parent = null;
        result = result.concat(collect(current));
        current.parent = parent;
    } while (
        current = current.parent
    );
    return result;
}
