import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Analysis_Key {
  id: UUIDString;
  __typename?: 'Analysis_Key';
}

export interface CreateRepositoryData {
  repository_insert: Repository_Key;
}

export interface CreateRepositoryVariables {
  name: string;
  githubUrl: string;
  userId: UUIDString;
}

export interface CreateUserData {
  user_insert: User_Key;
}

export interface CreateUserVariables {
  githubUsername: string;
  email: string;
  avatarUrl?: string | null;
}

export interface ListRepositoriesData {
  repositories: ({
    id: UUIDString;
    name: string;
    githubUrl: string;
    user: {
      githubUsername: string;
    };
  } & Repository_Key)[];
}

export interface ReadmeFile_Key {
  id: UUIDString;
  __typename?: 'ReadmeFile_Key';
}

export interface Repository_Key {
  id: UUIDString;
  __typename?: 'Repository_Key';
}

export interface Suggestion_Key {
  id: UUIDString;
  __typename?: 'Suggestion_Key';
}

export interface UpdateAnalysisScoreData {
  analysis_update?: Analysis_Key | null;
}

export interface UpdateAnalysisScoreVariables {
  id: UUIDString;
  score: number;
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
  operationName: string;
}
export const createUserRef: CreateUserRef;

export function createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;
export function createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateRepositoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateRepositoryVariables): MutationRef<CreateRepositoryData, CreateRepositoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateRepositoryVariables): MutationRef<CreateRepositoryData, CreateRepositoryVariables>;
  operationName: string;
}
export const createRepositoryRef: CreateRepositoryRef;

export function createRepository(vars: CreateRepositoryVariables): MutationPromise<CreateRepositoryData, CreateRepositoryVariables>;
export function createRepository(dc: DataConnect, vars: CreateRepositoryVariables): MutationPromise<CreateRepositoryData, CreateRepositoryVariables>;

interface ListRepositoriesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListRepositoriesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListRepositoriesData, undefined>;
  operationName: string;
}
export const listRepositoriesRef: ListRepositoriesRef;

export function listRepositories(options?: ExecuteQueryOptions): QueryPromise<ListRepositoriesData, undefined>;
export function listRepositories(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListRepositoriesData, undefined>;

interface UpdateAnalysisScoreRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAnalysisScoreVariables): MutationRef<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateAnalysisScoreVariables): MutationRef<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
  operationName: string;
}
export const updateAnalysisScoreRef: UpdateAnalysisScoreRef;

export function updateAnalysisScore(vars: UpdateAnalysisScoreVariables): MutationPromise<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
export function updateAnalysisScore(dc: DataConnect, vars: UpdateAnalysisScoreVariables): MutationPromise<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;

