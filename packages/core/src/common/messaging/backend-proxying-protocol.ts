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

import Route = require('route-parser');

/**
 * Path to the connection that will be used to pipe through proxies the backend
 * will fetch from the frontend.
 *
 * The frontend may open an arbitrary number of connections, but the backend
 * cannot initiate connections to the frontend by itself. Instead we will
 * have the frontend open a single connection and have the backend issue all
 * of its proxying requests through it.
 */
export const BACKEND_PROXYING_ROUTE = new Route('/backend-proxying/');
