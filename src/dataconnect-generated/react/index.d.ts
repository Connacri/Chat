import { CreateUserData, CreateUserVariables, CreateRepositoryData, CreateRepositoryVariables, ListRepositoriesData, UpdateAnalysisScoreData, UpdateAnalysisScoreVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateUser(options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;
export function useCreateUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateUserData, FirebaseError, CreateUserVariables>): UseDataConnectMutationResult<CreateUserData, CreateUserVariables>;

export function useCreateRepository(options?: useDataConnectMutationOptions<CreateRepositoryData, FirebaseError, CreateRepositoryVariables>): UseDataConnectMutationResult<CreateRepositoryData, CreateRepositoryVariables>;
export function useCreateRepository(dc: DataConnect, options?: useDataConnectMutationOptions<CreateRepositoryData, FirebaseError, CreateRepositoryVariables>): UseDataConnectMutationResult<CreateRepositoryData, CreateRepositoryVariables>;

export function useListRepositories(options?: useDataConnectQueryOptions<ListRepositoriesData>): UseDataConnectQueryResult<ListRepositoriesData, undefined>;
export function useListRepositories(dc: DataConnect, options?: useDataConnectQueryOptions<ListRepositoriesData>): UseDataConnectQueryResult<ListRepositoriesData, undefined>;

export function useUpdateAnalysisScore(options?: useDataConnectMutationOptions<UpdateAnalysisScoreData, FirebaseError, UpdateAnalysisScoreVariables>): UseDataConnectMutationResult<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
export function useUpdateAnalysisScore(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateAnalysisScoreData, FirebaseError, UpdateAnalysisScoreVariables>): UseDataConnectMutationResult<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
