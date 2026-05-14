# AppSumo Seat Limit Feature - Developer Quick Reference

## 🎯 Overview

This feature blocks member invitations when AppSumo users reach their seat limit and provides two resolution paths: deactivate a member or upgrade to Business plan.

---

## 🔑 Key Concepts

### **Seat Limits by Plan Type**
- **AppSumo LTD**: 10 seats per redeemed code
- **AppSumo Business** (5+ codes): 50 seats
- **Business Plan**: 25 seats (small), 100 seats (large)
- **Trial**: 5 seats
- **Override Flag**: `team_member_limit_override` bypasses all limits

### **Error Detection**
Backend returns `error_code: 'SEAT_LIMIT_EXCEEDED'` when limit is reached.

---

## 📂 File Structure

```
worklenz-backend/
├── src/
│   └── controllers/
│       ├── team-members-controller.ts      # Team invite seat checks
│       └── project-members-controller.ts   # Project invite seat checks

worklenz-frontend/
├── src/
│   ├── components/
│   │   └── common/
│   │       ├── seat-limit-modal/
│   │       │   ├── SeatLimitModal.tsx      # Blocking modal component
│   │       │   └── index.ts
│   │       ├── invite-team-members/
│   │       │   └── InviteTeamMembers.tsx   # Team invite integration
│   │       └── invite-project-members/
│   │           └── InviteProjectMembers.tsx # Project invite integration
│   ├── features/
│   │   └── seat-limit/
│   │       └── seatLimitSlice.ts           # Redux state management
│   ├── pages/
│   │   └── settings/
│   │       └── team-members/
│   │           └── team-members-settings.tsx # Auto-send logic
│   └── app/
│       └── store.ts                         # Redux store config
```

---

## 🔧 Backend API Response

### **Success Response**
```typescript
{
  done: true,
  body: { /* member data */ },
  message: "Invitation sent"
}
```

### **Seat Limit Error Response**
```typescript
{
  done: false,
  body: {
    error_code: 'SEAT_LIMIT_EXCEEDED',
    seats_enough: false,
    current_members: 10,
    plan_seat_limit: 10,
    business_plan_limit: 25,
    is_appsumo_user: true,
    subscription_type: 'LIFE_TIME_DEAL',
    current_seat_amount: 10
  },
  message: "Your AppSumo plan includes 10 members. Deactivate an inactive member to invite someone new, or upgrade to Business for 25 members."
}
```

---

## 💻 Frontend Integration Pattern

### **1. Detect Error in API Response**
```typescript
const res = await teamMembersApiService.createTeamMember(body);

if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
  setSeatLimitData(res.body);
  setPendingInvite(body);
  setSeatLimitModalOpen(true);
  return;
}
```

### **2. Render SeatLimitModal**
```typescript
{seatLimitData && (
  <SeatLimitModal
    open={seatLimitModalOpen}
    onClose={handleSeatLimitModalClose}
    currentMembers={seatLimitData.current_members}
    planLimit={seatLimitData.plan_seat_limit}
    businessLimit={seatLimitData.business_plan_limit}
    isAppSumoUser={seatLimitData.is_appsumo_user}
    onUpgrade={handleSeatLimitUpgrade}
    onDeactivate={handleSeatLimitDeactivate}
  />
)}
```

### **3. Handle Modal Actions**
```typescript
const handleSeatLimitUpgrade = () => {
  setSeatLimitModalOpen(false);
  dispatch(toggleUpgradeModal());
};

const handleSeatLimitDeactivate = () => {
  setSeatLimitModalOpen(false);
  if (pendingInvite) {
    localStorage.setItem('pendingTeamInvite', JSON.stringify(pendingInvite));
  }
  navigate('/settings/team-members');
};

const handleSeatLimitModalClose = () => {
  setSeatLimitModalOpen(false);
  setPendingInvite(null);
  setSeatLimitData(null);
};
```

### **4. Auto-Send After Deactivation**
```typescript
// In team-members-settings.tsx
const handleStatusChange = async (record: ITeamMemberViewModel) => {
  const res = await teamMembersApiService.toggleMemberActiveStatus(...);
  
  if (res.done) {
    await getTeamMembers();
    
    // Check for pending invite
    const pendingInvite = localStorage.getItem('pendingTeamInvite');
    if (pendingInvite && !record.active) {
      const inviteData = JSON.parse(pendingInvite);
      const inviteRes = await teamMembersApiService.createTeamMember(inviteData);
      if (inviteRes.done) {
        message.success('Member deactivated. Your invite has been sent.');
        localStorage.removeItem('pendingTeamInvite');
      }
    }
  }
};
```

---

## 🎨 Component Props

### **SeatLimitModal Props**
```typescript
interface SeatLimitModalProps {
  open: boolean;                // Modal visibility
  onClose: () => void;          // Close handler (X button)
  currentMembers: number;       // Current active member count
  planLimit: number;            // User's plan seat limit
  businessLimit: number;        // Business plan limit (25)
  isAppSumoUser: boolean;       // AppSumo user flag
  onUpgrade: () => void;        // Upgrade button handler
  onDeactivate: () => void;     // Deactivate button handler
}
```

---

## 🗄️ Redux State

### **Seat Limit Slice**
```typescript
interface SeatLimitState {
  isModalOpen: boolean;
  seatLimitData: SeatLimitData | null;
  pendingInvite: PendingInvite | null;
}

// Actions
openSeatLimitModal({ seatLimitData, pendingInvite })
closeSeatLimitModal()
clearPendingInvite()
```

### **Usage**
```typescript
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { openSeatLimitModal } from '@/features/seat-limit/seatLimitSlice';

const dispatch = useAppDispatch();

dispatch(openSeatLimitModal({
  seatLimitData: res.body,
  pendingInvite: { type: 'team', data: body }
}));
```

---

## 💾 LocalStorage Keys

### **pendingTeamInvite**
```typescript
{
  job_title: string | null,
  emails: string[],
  is_admin: boolean,
  role_name: string
}
```

### **pendingProjectInvite**
```typescript
{
  emails: string[],
  access: 'member' | 'team-lead' | 'admin',
  projectId: string,
  projectName: string
}
```

---

## 🌐 i18n Translation Keys

### **Required Keys** (in `settings/team-members` namespace)
```typescript
{
  "seatLimitReached": "Seat Limit Reached",
  "seatLimitAppSumoMessage": "Your AppSumo plan includes {{planLimit}} members.",
  "seatLimitMessage": "Your plan includes {{planLimit}} members.",
  "seatLimitCurrentUsage": "You are currently using {{currentMembers}} of {{planLimit}} seats.",
  "seatLimitOptions": "To invite a new member, you can:",
  "deactivateMember": "Deactivate a Member",
  "upgradeToBusiness": "Upgrade to Business",
  "seatLimitFooter": "Current members: {{currentMembers}} | Plan limit: {{planLimit}} | After upgrade: {{businessLimit}}",
  "memberDeactivatedInviteSent": "Member deactivated. Your invite has been sent.",
  "memberDeactivatedProjectInviteSent": "Member deactivated. Project invite sent for \"{{projectName}}\"."
}
```

---

## 🔍 Debugging Tips

### **Check Backend Response**
```typescript
console.log('API Response:', res);
console.log('Error Code:', res.body?.error_code);
console.log('Seat Limit Data:', res.body);
```

### **Check LocalStorage**
```typescript
console.log('Pending Team Invite:', localStorage.getItem('pendingTeamInvite'));
console.log('Pending Project Invite:', localStorage.getItem('pendingProjectInvite'));
```

### **Check Redux State**
```typescript
import { useAppSelector } from '@/hooks/useAppSelector';

const seatLimitState = useAppSelector(state => state.seatLimitReducer);
console.log('Seat Limit State:', seatLimitState);
```

### **Check Modal Props**
```typescript
console.log('Modal Open:', seatLimitModalOpen);
console.log('Seat Limit Data:', seatLimitData);
console.log('Pending Invite:', pendingInvite);
```

---

## 🚨 Common Pitfalls

### **1. Forgetting to Check Error Code**
❌ **Wrong:**
```typescript
if (!res.done) {
  message.error(res.message);
}
```

✅ **Correct:**
```typescript
if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
  // Show seat limit modal
} else if (!res.done) {
  message.error(res.message);
}
```

### **2. Not Clearing LocalStorage**
❌ **Wrong:**
```typescript
const inviteData = JSON.parse(localStorage.getItem('pendingTeamInvite'));
await sendInvite(inviteData);
// LocalStorage not cleared!
```

✅ **Correct:**
```typescript
const inviteData = JSON.parse(localStorage.getItem('pendingTeamInvite'));
await sendInvite(inviteData);
localStorage.removeItem('pendingTeamInvite'); // Clear after use
```

### **3. Not Handling Null Checks**
❌ **Wrong:**
```typescript
const pendingInvite = localStorage.getItem('pendingTeamInvite');
const inviteData = JSON.parse(pendingInvite); // Can throw if null
```

✅ **Correct:**
```typescript
const pendingInvite = localStorage.getItem('pendingTeamInvite');
if (pendingInvite) {
  try {
    const inviteData = JSON.parse(pendingInvite);
    // Use inviteData
  } catch (error) {
    console.error('Error parsing pending invite:', error);
    localStorage.removeItem('pendingTeamInvite');
  }
}
```

### **4. Forgetting to Import Dependencies**
```typescript
// Required imports for integration
import { SeatLimitModal } from '@/components/common/seat-limit-modal';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useNavigate } from 'react-router-dom';
import { message } from '@/shared/antd-imports';
```

---

## 🧩 Adding to New Invite Flows

If you need to add seat limit checking to a new invite flow:

### **Step 1: Add State**
```typescript
const [seatLimitModalOpen, setSeatLimitModalOpen] = useState(false);
const [seatLimitData, setSeatLimitData] = useState<any>(null);
const [pendingInvite, setPendingInvite] = useState<any>(null);
```

### **Step 2: Check API Response**
```typescript
const res = await yourApiService.inviteMember(body);

if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
  setSeatLimitData(res.body);
  setPendingInvite(body);
  setSeatLimitModalOpen(true);
  return;
}
```

### **Step 3: Add Modal Handlers**
```typescript
const handleSeatLimitUpgrade = () => {
  setSeatLimitModalOpen(false);
  dispatch(toggleUpgradeModal());
};

const handleSeatLimitDeactivate = () => {
  setSeatLimitModalOpen(false);
  if (pendingInvite) {
    localStorage.setItem('pendingYourInvite', JSON.stringify(pendingInvite));
  }
  navigate('/settings/team-members');
};

const handleSeatLimitModalClose = () => {
  setSeatLimitModalOpen(false);
  setPendingInvite(null);
  setSeatLimitData(null);
};
```

### **Step 4: Render Modal**
```typescript
{seatLimitData && (
  <SeatLimitModal
    open={seatLimitModalOpen}
    onClose={handleSeatLimitModalClose}
    currentMembers={seatLimitData.current_members}
    planLimit={seatLimitData.plan_seat_limit}
    businessLimit={seatLimitData.business_plan_limit}
    isAppSumoUser={seatLimitData.is_appsumo_user}
    onUpgrade={handleSeatLimitUpgrade}
    onDeactivate={handleSeatLimitDeactivate}
  />
)}
```

### **Step 5: Add Auto-Send Logic**
In `team-members-settings.tsx`, add check for your localStorage key:
```typescript
const pendingYourInvite = localStorage.getItem('pendingYourInvite');
if (pendingYourInvite && !record.active) {
  // Send your invite
  localStorage.removeItem('pendingYourInvite');
}
```

---

## 📚 Related Documentation

- **Backend Seat Limits**: `worklenz-backend/src/shared/subscription-limits.ts`
- **AppSumo Service**: `worklenz-backend/src/services/appsumo-service.ts`
- **Subscription Utils**: `worklenz-frontend/src/utils/subscription-utils.ts`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY_SEAT_LIMIT.md`
- **Testing Guide**: `TESTING_GUIDE_SEAT_LIMIT.md`

---

## 🤝 Contributing

When modifying this feature:
1. Update all 4 touch points (team email/link, project email/link)
2. Test in both light and dark themes
3. Verify i18n translations
4. Update this documentation
5. Add test cases to testing guide

---

## 📞 Questions?

Contact the development team or refer to:
- Implementation Summary for high-level overview
- Testing Guide for QA procedures
- This guide for technical details
