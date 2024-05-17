// import mixpanel, {Dict} from 'mixpanel-browser';
// import {getSession} from "@shared/session-helper";
// import {ILocalSession} from "@interfaces/api-models/local-session";
// import {environment} from "../../environments/environment";
//
// export class WorklenzAnalytics {
//   private static readonly LOCAL_SERVERS = "a280d9b1efe06ac76b553e73e229cb47";
//   private static readonly TEST_SERVERS = "a04c24bcf1cf06cc5ceceeb5179c0e90";
//   private static readonly PRODUCTION = "bb330b6bd25db4a6c988da89046f4b80";
//
//   private static get TOKEN() {
//     const host = window.location.host;
//     if (host === "uat.worklenz.com" || host === "dev.worklenz.com")
//       return this.TEST_SERVERS;
//     if (host === "app.worklenz.com")
//       return this.PRODUCTION;
//     return this.LOCAL_SERVERS;
//   }
//
//   private static session: ILocalSession | null = null;
//
//   public static init() {
//     mixpanel.init(this.TOKEN, {debug: !environment.production});
//   }
//
//   public static setIdentity(user: ILocalSession) {
//     if (user.id) {
//       mixpanel.identify(user.id);
//       mixpanel.people.set({
//         $user_id: user.id,
//         $name: user.name,
//         $email: user.email,
//         $avatar: user.avatar_url
//       });
//     }
//   }
//
//   public static reset() {
//     mixpanel.reset();
//   }
//
//   public static track(event: string, properties?: Dict) {
//     try {
//       let props: any = {};
//
//       this.updateSession();
//
//       if (this.session) props.id = this.session.user_no;
//
//       if (properties) {
//         props = {...properties, ...props};
//       }
//
//       mixpanel.track(event, props);
//     } catch (e) {
//       // ignore
//     }
//   }
//
//   private static updateSession() {
//     if (this.session) return;
//     const session = getSession();
//     if (session && session.user_no)
//       this.session = session;
//   }
// }
