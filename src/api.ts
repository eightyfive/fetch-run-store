import { Api } from "fetch-run";
import { createQuery } from "./query";
import { createMutation } from "./mutation";
import {
  createListQuery,
  createReadQuery,
  createSearchQuery,
} from "./resource";

export function createApiStore(api: Api) {
  const ns = api.baseUrl;

  return {
    createQuery<R extends string, Res extends object>(
      route: R,
      execute: (url: string) => Promise<Res | undefined>
    ) {
      return createQuery<R, Res>(ns, route, execute);
    },

    createMutation,

    route<R extends string>(route: R) {
      return {
        create<Req extends object | void, Res extends object | void>() {
          return createMutation<R, Req, Res>(route, (url, req: Req) =>
            api.post<Res, Req>(url, req)
          );
        },
        read<Item extends object>() {
          return createReadQuery<R, Item>(ns, route, (url) =>
            api.get<Item>(url)
          );
        },
        update<Req extends object | void, Res extends object | void>() {
          return createMutation<R, Req, Res>(route, (url, req: Req) =>
            api.put<Res, Req>(url, req)
          );
        },
        delete<Res extends object | void = void>() {
          return createMutation<R, void, Res>(route, (url) =>
            api.delete<Res>(url)
          );
        },
        list<ListItem extends object>() {
          return createListQuery<R, ListItem[]>(ns, route, (url) =>
            api.get<ListItem[]>(url)
          );
        },
        search<ListItem extends object>() {
          return createSearchQuery<R, ListItem[]>(ns, route, (url) =>
            api.get<ListItem[]>(url)
          );
        },
      };
    },
  };
}

// const api = Api.create("");

// const apiStore = createApiStore(api);

// type User = { id: number; name: string };
// const userRoute = apiStore.route("users");
// const useUser = userRoute.read<User>();
// const useUsers = userRoute.list<User>();
// const useCreateUser = userRoute.create<User, void>();

// type Post = { id: number; title: string };
// const postRoute = apiStore.route("users/:userId/posts");
// const useUserPost = postRoute.read<Post>();

// type Comment = { id: number; text: string };
// const userPostComment = apiStore.route("users/:userId/posts/:postId/comments");

// const useUserPostComment = userPostComment.read<Comment>();

// function Example() {
//   const { data: user } = useUser(123);
//   const { data: post } = useUserPost(123, { userId: 111 });
//   const { data: comment } = useUserPostComment(123, {
//     userId: "bar",
//     postId: 789,
//   });
// }
