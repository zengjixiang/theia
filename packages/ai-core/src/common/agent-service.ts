// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
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
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************
import { inject, injectable, named } from '@theia/core/shared/inversify';
import { ContributionProvider } from '@theia/core';
import { Agent } from './agent';

export const AgentService = Symbol('AgentService');

/**
 * Service to access the list of known Agents.
 */
export interface AgentService {
    /**
     * Retrieves a list of all available agents, i.e. agents which are not disabled
     */
    getAgents(): Agent[];
    /**
     * Retrieves a list of all agents, including disabled ones.
     */
    getAllAgents(): Agent[];
    /**
     * Enable the agent with the specified id.
     * @param agentId the agent id.
     */
    enableAgent(agentId: string): void;
    /**
     * disable the agent with the specified id.
     * @param agentId the agent id.
     */
    disableAgent(agentId: string): void;
    /**
     * query whether this agent is currently enabled or disabled.
     * @param agentId the agent id.
     * @return true if the agent is enabled, false otherwise.
     */
    isEnabled(agentId: string): boolean;
}

@injectable()
export class AgentServiceImpl implements AgentService {

    @inject(ContributionProvider) @named(Agent)
    protected readonly agentsProvider: ContributionProvider<Agent>;

    protected disabledAgents = new Set<string>();

    protected _agents: Agent[] = [];

    private get agents(): Agent[] {
        // We can't collect the contributions at @postConstruct because this will lead to a circular dependency
        // with agents reusing the chat agent service (e.g. orchestrator) which in turn injects the agent service
        return [...this.agentsProvider.getContributions(), ...this._agents];
    }

    registerAgent(agent: Agent): void {
        this._agents.push(agent);
    }

    getAgents(): Agent[] {
        return this.agents.filter(agent => this.isEnabled(agent.id));
    }

    getAllAgents(): Agent[] {
        return this.agents;
    }

    enableAgent(agentId: string): void {
        this.disabledAgents.delete(agentId);
    }

    disableAgent(agentId: string): void {
        this.disabledAgents.add(agentId);
    }

    isEnabled(agentId: string): boolean {
        return !this.disabledAgents.has(agentId);
    }
}
