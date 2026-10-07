import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { whatsNewApiService } from '@/api/whats-new/whats-new.api.service';
import { IWhatsNewRelease } from '@/types/whats-new/whats-new.types';

type WhatsNewState = {
  currentRelease: IWhatsNewRelease | null;
  isModalOpen: boolean;
  loading: boolean;
  // Drawer-driven viewer: fully independent of currentRelease/isModalOpen
  // above, so opening/closing it can never touch (or be touched by) the nav
  // tag's own dismissal state. See notfication-drawer.tsx's goToUrl.
  viewedRelease: IWhatsNewRelease | null;
  isViewedModalOpen: boolean;
  viewedLoading: boolean;
  viewedNotFound: boolean;
};

const initialState: WhatsNewState = {
  currentRelease: null,
  isModalOpen: false,
  loading: false,
  viewedRelease: null,
  isViewedModalOpen: false,
  viewedLoading: false,
  viewedNotFound: false,
};

export const fetchCurrentRelease = createAsyncThunk('whatsNew/fetchCurrentRelease', async () => {
  const res = await whatsNewApiService.getCurrent();
  return res.body ?? null;
});

export const fetchReleaseById = createAsyncThunk('whatsNew/fetchReleaseById', async (releaseId: string) => {
  const res = await whatsNewApiService.getById(releaseId);
  return res.body ?? null;
});

// Fire-and-forget from the caller's perspective (FR-3.9 / EC-25): the reducer
// hides the release optimistically in the `.pending` case below, before this
// network call resolves, and does not roll back on failure within the same
// session — the tag/card stay hidden either way, only reappearing on the
// next app load if the write never landed server-side.
export const dismissRelease = createAsyncThunk(
  'whatsNew/dismissRelease',
  async (releaseId: string) => {
    try {
      await whatsNewApiService.dismiss(releaseId);
    } catch {
      // Swallowed on purpose - see the optimistic-hide note above.
    }
  }
);

const whatsNewSlice = createSlice({
  name: 'whatsNewReducer',
  initialState,
  reducers: {
    openWhatsNewModal: state => {
      state.isModalOpen = true;
    },
    closeWhatsNewModal: state => {
      state.isModalOpen = false;
    },
    // Only ever clears the viewer's own open flag — never dismisses anything,
    // never touches currentRelease/isModalOpen or user_release_dismissals.
    closeReleaseViewer: state => {
      state.isViewedModalOpen = false;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchCurrentRelease.pending, state => {
      state.loading = true;
    });
    builder.addCase(fetchCurrentRelease.fulfilled, (state, action) => {
      state.loading = false;
      state.currentRelease = action.payload;
    });
    builder.addCase(fetchCurrentRelease.rejected, state => {
      state.loading = false;
    });
    builder.addCase(dismissRelease.pending, state => {
      state.currentRelease = null;
      state.isModalOpen = false;
    });
    builder.addCase(fetchReleaseById.pending, state => {
      state.isViewedModalOpen = true;
      state.viewedLoading = true;
      state.viewedNotFound = false;
      state.viewedRelease = null;
    });
    builder.addCase(fetchReleaseById.fulfilled, (state, action) => {
      state.viewedLoading = false;
      state.viewedRelease = action.payload;
      state.viewedNotFound = !action.payload;
    });
    builder.addCase(fetchReleaseById.rejected, state => {
      state.viewedLoading = false;
      state.viewedNotFound = true;
    });
  },
});

export const { openWhatsNewModal, closeWhatsNewModal, closeReleaseViewer } = whatsNewSlice.actions;
export default whatsNewSlice.reducer;
