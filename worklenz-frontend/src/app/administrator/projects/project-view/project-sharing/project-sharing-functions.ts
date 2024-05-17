//
// get sharePopoverTitle() {
//   if (this.loadingSharingInfo) return 'Loading...';
//   return this.sharingEnabled ? 'Share a read-only version of this project' : 'Enable sharing on this project?';
// };
//
// get sharingEnabled() {
//   return !!(this.sharedInfo && this.sharedInfo.url);
// }
//
// async enableSharing() {
//   try {
//     this.enablingSharing = true;
//     const res = await this.sharedProjectsApi.create({project_id: this.projectId});
//     this.enablingSharing = false;
//     if (res.done) {
//       this.getSharingInfo();
//     }
//   } catch (e) {
//     this.enablingSharing = false;
//   }
// }
//
// async cancelSharing() {
//   try {
//     this.sharingCanceling = true;
//     const res = await this.sharedProjectsApi.delete(this.projectId);
//     this.sharingCanceling = false;
//     if (res.done) {
//       this.sharedInfo = {};
//     }
//   } catch (e) {
//     this.sharingCanceling = false;
//   }
// }
//
// async copy(textElement: HTMLSpanElement) {
//   if (!this.sharingEnabled) return;
//   textElement.innerText = "Copied!";
//   await navigator.clipboard.writeText(this.sharedInfo.url as string);
//   setTimeout(() => {
//     textElement.innerText = "Copy";
//   }, 500);
// }
