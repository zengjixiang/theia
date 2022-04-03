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

import { AnyConnection, Deferred, Handler } from '../../common';
import { BACKEND_PROXYING_ROUTE } from '../../common/messaging/backend-proxying-protocol';

/**
 * @internal
 */
export class FrontendServiceConnectionProvider {

    protected deferredConnection = new Deferred<AnyConnection>();

    get backendProxyingConnection(): Promise<AnyConnection> {
        return this.deferredConnection.promise;
    }

    createConnectionHandler(): Handler<AnyConnection> {
        return ({ path }, accept, next) => {
            if (typeof path !== 'string') {
                return next();
            }
            const match = BACKEND_PROXYING_ROUTE.match(path);
            if (!match) {
                return next();
            }
            if (this.deferredConnection.state !== 'unresolved') {
                // we only expect one connection!
                return next(new Error('invalid connection'));
            }
            const connection = accept();
            this.deferredConnection.resolve(connection);
            connection.onClose(() => console.debug('The backend connection used to get proxies to frontend objects got closed'));
        };
    }
}
