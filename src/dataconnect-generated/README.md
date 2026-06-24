# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListRepositories*](#listrepositories)
- [**Mutations**](#mutations)
  - [*CreateUser*](#createuser)
  - [*CreateRepository*](#createrepository)
  - [*UpdateAnalysisScore*](#updateanalysisscore)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListRepositories
You can execute the `ListRepositories` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listRepositories(options?: ExecuteQueryOptions): QueryPromise<ListRepositoriesData, undefined>;

interface ListRepositoriesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListRepositoriesData, undefined>;
}
export const listRepositoriesRef: ListRepositoriesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listRepositories(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<ListRepositoriesData, undefined>;

interface ListRepositoriesRef {
  ...
  (dc: DataConnect): QueryRef<ListRepositoriesData, undefined>;
}
export const listRepositoriesRef: ListRepositoriesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listRepositoriesRef:
```typescript
const name = listRepositoriesRef.operationName;
console.log(name);
```

### Variables
The `ListRepositories` query has no variables.
### Return Type
Recall that executing the `ListRepositories` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListRepositoriesData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `ListRepositories`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listRepositories } from '@dataconnect/generated';


// Call the `listRepositories()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listRepositories();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listRepositories(dataConnect);

console.log(data.repositories);

// Or, you can use the `Promise` API.
listRepositories().then((response) => {
  const data = response.data;
  console.log(data.repositories);
});
```

### Using `ListRepositories`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listRepositoriesRef } from '@dataconnect/generated';


// Call the `listRepositoriesRef()` function to get a reference to the query.
const ref = listRepositoriesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listRepositoriesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.repositories);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.repositories);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateUser
You can execute the `CreateUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createUser(vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createUser(dc: DataConnect, vars: CreateUserVariables): MutationPromise<CreateUserData, CreateUserVariables>;

interface CreateUserRef {
  ...
  (dc: DataConnect, vars: CreateUserVariables): MutationRef<CreateUserData, CreateUserVariables>;
}
export const createUserRef: CreateUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createUserRef:
```typescript
const name = createUserRef.operationName;
console.log(name);
```

### Variables
The `CreateUser` mutation requires an argument of type `CreateUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateUserVariables {
  githubUsername: string;
  email: string;
  avatarUrl?: string | null;
}
```
### Return Type
Recall that executing the `CreateUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateUserData {
  user_insert: User_Key;
}
```
### Using `CreateUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createUser, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  githubUsername: ..., 
  email: ..., 
  avatarUrl: ..., // optional
};

// Call the `createUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createUser(createUserVars);
// Variables can be defined inline as well.
const { data } = await createUser({ githubUsername: ..., email: ..., avatarUrl: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createUser(dataConnect, createUserVars);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
createUser(createUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

### Using `CreateUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createUserRef, CreateUserVariables } from '@dataconnect/generated';

// The `CreateUser` mutation requires an argument of type `CreateUserVariables`:
const createUserVars: CreateUserVariables = {
  githubUsername: ..., 
  email: ..., 
  avatarUrl: ..., // optional
};

// Call the `createUserRef()` function to get a reference to the mutation.
const ref = createUserRef(createUserVars);
// Variables can be defined inline as well.
const ref = createUserRef({ githubUsername: ..., email: ..., avatarUrl: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createUserRef(dataConnect, createUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_insert);
});
```

## CreateRepository
You can execute the `CreateRepository` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createRepository(vars: CreateRepositoryVariables): MutationPromise<CreateRepositoryData, CreateRepositoryVariables>;

interface CreateRepositoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateRepositoryVariables): MutationRef<CreateRepositoryData, CreateRepositoryVariables>;
}
export const createRepositoryRef: CreateRepositoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createRepository(dc: DataConnect, vars: CreateRepositoryVariables): MutationPromise<CreateRepositoryData, CreateRepositoryVariables>;

interface CreateRepositoryRef {
  ...
  (dc: DataConnect, vars: CreateRepositoryVariables): MutationRef<CreateRepositoryData, CreateRepositoryVariables>;
}
export const createRepositoryRef: CreateRepositoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createRepositoryRef:
```typescript
const name = createRepositoryRef.operationName;
console.log(name);
```

### Variables
The `CreateRepository` mutation requires an argument of type `CreateRepositoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateRepositoryVariables {
  name: string;
  githubUrl: string;
  userId: UUIDString;
}
```
### Return Type
Recall that executing the `CreateRepository` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateRepositoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateRepositoryData {
  repository_insert: Repository_Key;
}
```
### Using `CreateRepository`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createRepository, CreateRepositoryVariables } from '@dataconnect/generated';

// The `CreateRepository` mutation requires an argument of type `CreateRepositoryVariables`:
const createRepositoryVars: CreateRepositoryVariables = {
  name: ..., 
  githubUrl: ..., 
  userId: ..., 
};

// Call the `createRepository()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createRepository(createRepositoryVars);
// Variables can be defined inline as well.
const { data } = await createRepository({ name: ..., githubUrl: ..., userId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createRepository(dataConnect, createRepositoryVars);

console.log(data.repository_insert);

// Or, you can use the `Promise` API.
createRepository(createRepositoryVars).then((response) => {
  const data = response.data;
  console.log(data.repository_insert);
});
```

### Using `CreateRepository`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createRepositoryRef, CreateRepositoryVariables } from '@dataconnect/generated';

// The `CreateRepository` mutation requires an argument of type `CreateRepositoryVariables`:
const createRepositoryVars: CreateRepositoryVariables = {
  name: ..., 
  githubUrl: ..., 
  userId: ..., 
};

// Call the `createRepositoryRef()` function to get a reference to the mutation.
const ref = createRepositoryRef(createRepositoryVars);
// Variables can be defined inline as well.
const ref = createRepositoryRef({ name: ..., githubUrl: ..., userId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createRepositoryRef(dataConnect, createRepositoryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.repository_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.repository_insert);
});
```

## UpdateAnalysisScore
You can execute the `UpdateAnalysisScore` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateAnalysisScore(vars: UpdateAnalysisScoreVariables): MutationPromise<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;

interface UpdateAnalysisScoreRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateAnalysisScoreVariables): MutationRef<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
}
export const updateAnalysisScoreRef: UpdateAnalysisScoreRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateAnalysisScore(dc: DataConnect, vars: UpdateAnalysisScoreVariables): MutationPromise<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;

interface UpdateAnalysisScoreRef {
  ...
  (dc: DataConnect, vars: UpdateAnalysisScoreVariables): MutationRef<UpdateAnalysisScoreData, UpdateAnalysisScoreVariables>;
}
export const updateAnalysisScoreRef: UpdateAnalysisScoreRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateAnalysisScoreRef:
```typescript
const name = updateAnalysisScoreRef.operationName;
console.log(name);
```

### Variables
The `UpdateAnalysisScore` mutation requires an argument of type `UpdateAnalysisScoreVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateAnalysisScoreVariables {
  id: UUIDString;
  score: number;
}
```
### Return Type
Recall that executing the `UpdateAnalysisScore` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateAnalysisScoreData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateAnalysisScoreData {
  analysis_update?: Analysis_Key | null;
}
```
### Using `UpdateAnalysisScore`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateAnalysisScore, UpdateAnalysisScoreVariables } from '@dataconnect/generated';

// The `UpdateAnalysisScore` mutation requires an argument of type `UpdateAnalysisScoreVariables`:
const updateAnalysisScoreVars: UpdateAnalysisScoreVariables = {
  id: ..., 
  score: ..., 
};

// Call the `updateAnalysisScore()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateAnalysisScore(updateAnalysisScoreVars);
// Variables can be defined inline as well.
const { data } = await updateAnalysisScore({ id: ..., score: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateAnalysisScore(dataConnect, updateAnalysisScoreVars);

console.log(data.analysis_update);

// Or, you can use the `Promise` API.
updateAnalysisScore(updateAnalysisScoreVars).then((response) => {
  const data = response.data;
  console.log(data.analysis_update);
});
```

### Using `UpdateAnalysisScore`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateAnalysisScoreRef, UpdateAnalysisScoreVariables } from '@dataconnect/generated';

// The `UpdateAnalysisScore` mutation requires an argument of type `UpdateAnalysisScoreVariables`:
const updateAnalysisScoreVars: UpdateAnalysisScoreVariables = {
  id: ..., 
  score: ..., 
};

// Call the `updateAnalysisScoreRef()` function to get a reference to the mutation.
const ref = updateAnalysisScoreRef(updateAnalysisScoreVars);
// Variables can be defined inline as well.
const ref = updateAnalysisScoreRef({ id: ..., score: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateAnalysisScoreRef(dataConnect, updateAnalysisScoreVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.analysis_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.analysis_update);
});
```

