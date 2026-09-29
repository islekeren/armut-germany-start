"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts";
import {
  authApi,
  getStoredAccessToken,
  uploadsApi,
  usersApi,
} from "@/lib/api";
import { FormInput } from "@/components/forms/FormInput";
import { FormLabel } from "@/components/forms/FormLabel";
import { PanelCard } from "@/components/ui/PanelCard";
import { useApiErrorMessage } from "@/lib/api-errors";

type NotificationPreferences = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  smsNotifications: false,
  marketingEmails: false,
};

interface AccountSettingsContentProps {
  role: "customer" | "provider";
}

export function AccountSettingsContent({ role }: AccountSettingsContentProps) {
  const { user, refreshAuth, logout } = useAuth();
  const tDelete = useTranslations("accountDeletion");
  const tS = useTranslations("accountSettings");
  const describeError = useApiErrorMessage();

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const [profileMessage, setProfileMessage] = useState("");
  const [preferencesMessage, setPreferencesMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const preferenceStorageKey = useMemo(() => {
    if (!user?.id) return null;
    return `armut_settings_preferences_${user.id}`;
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      const token = getStoredAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await usersApi.getProfile(token);
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
        setEmail(profile.email || "");
        setPhone(profile.phone || "");
        setProfileImage(profile.profileImage || null);
      } catch (error) {
        console.error("Failed to load settings profile", error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!preferenceStorageKey) return;

    const raw = localStorage.getItem(preferenceStorageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as NotificationPreferences;
      setPreferences({
        emailNotifications: !!parsed.emailNotifications,
        pushNotifications: !!parsed.pushNotifications,
        smsNotifications: !!parsed.smsNotifications,
        marketingEmails: !!parsed.marketingEmails,
      });
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, [preferenceStorageKey]);

  const handleProfileSave = async () => {
    setIsSavingProfile(true);
    setProfileMessage("");

    try {
      const token = getStoredAccessToken();
      if (!token) {
        setProfileMessage(tS("loginAgain"));
        return;
      }

      let nextProfileImage = profileImage;
      if (selectedImage) {
        const uploaded = await uploadsApi.uploadProfileImage(token, selectedImage);
        nextProfileImage = uploaded.url;
      }

      const updated = await usersApi.updateProfile(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        profileImage: nextProfileImage || undefined,
      });

      setFirstName(updated.firstName || "");
      setLastName(updated.lastName || "");
      setPhone(updated.phone || "");
      setProfileImage(updated.profileImage || null);
      setSelectedImage(null);

      await refreshAuth();
      setProfileMessage(tS("profileSaved"));
    } catch (error) {
      console.error("Failed to update settings profile", error);
      setProfileMessage(describeError(error, tS("profileError")));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePreferencesSave = async () => {
    setIsSavingPreferences(true);
    setPreferencesMessage("");
    try {
      if (preferenceStorageKey) {
        localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
      }
      setPreferencesMessage(tS("preferencesSaved"));
    } catch (error) {
      console.error("Failed to save preferences", error);
      setPreferencesMessage(tS("preferencesError"));
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handlePasswordSave = async () => {
    setIsChangingPassword(true);
    setPasswordMessage("");

    try {
      const token = getStoredAccessToken();
      if (!token) {
        setPasswordMessage(tS("loginAgain"));
        return;
      }

      if (newPassword.length < 8) {
        setPasswordMessage(tS("passwordTooShort"));
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordMessage(tS("passwordMismatch"));
        return;
      }

      await authApi.changePassword(token, {
        currentPassword,
        newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage(tS("passwordChanged"));
    } catch (error) {
      console.error("Failed to change password", error);
      setPasswordMessage(describeError(error, tS("passwordError")));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteMessage("");
    if (deleteConfirm.trim().toUpperCase() !== tDelete("confirmWord")) {
      setDeleteMessage(tDelete("confirmError", { word: tDelete("confirmWord") }));
      return;
    }

    setIsDeletingAccount(true);
    try {
      const token = getStoredAccessToken();
      if (!token) {
        setDeleteMessage(tDelete("loginAgain"));
        return;
      }

      await usersApi.deleteProfile(token);
      await logout();
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to delete profile", error);
      setDeleteMessage(describeError(error, tDelete("error")));
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoading) {
    return (
      <PanelCard>
        <p className="text-sm text-muted">{tS("loading")}</p>
      </PanelCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PanelCard className="space-y-4">
        <h2 className="text-lg font-semibold">{tS("profileTitle")}</h2>
        <p className="text-sm text-muted">
          {tS(role === "provider" ? "profileDescriptionProvider" : "profileDescriptionCustomer")}
        </p>

        <div>
          <FormLabel htmlFor="settings-first-name">{tS("firstName")}</FormLabel>
          <FormInput
            id="settings-first-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-last-name">{tS("lastName")}</FormLabel>
          <FormInput
            id="settings-last-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-email">{tS("email")}</FormLabel>
          <FormInput id="settings-email" value={email} readOnly />
          <p className="mt-1 text-xs text-muted">
            {tS("emailHint")}
          </p>
        </div>

        <div>
          <FormLabel htmlFor="settings-phone">{tS("phone")}</FormLabel>
          <FormInput
            id="settings-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-profile-image">{tS("profileImage")}</FormLabel>
          <FormInput
            id="settings-profile-image"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              setSelectedImage(file);
            }}
          />
          {profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileImage}
              alt={tS("profilePreview")}
              className="mt-3 h-16 w-16 rounded-full border border-border object-cover"
            />
          ) : null}
        </div>

        {profileMessage ? <p className="text-sm text-muted">{profileMessage}</p> : null}

        <button
          type="button"
          onClick={handleProfileSave}
          disabled={isSavingProfile}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {isSavingProfile ? tS("saving") : tS("saveProfile")}
        </button>
      </PanelCard>

      <PanelCard className="space-y-4">
        <h2 className="text-lg font-semibold">{tS("notificationsTitle")}</h2>
        <p className="text-sm text-muted">
          {tS("notificationsDescription")}
        </p>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>{tS("emailNotifications")}</span>
          <input
            type="checkbox"
            checked={preferences.emailNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                emailNotifications: event.target.checked,
              }))
            }
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>{tS("pushNotifications")}</span>
          <input
            type="checkbox"
            checked={preferences.pushNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                pushNotifications: event.target.checked,
              }))
            }
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>{tS("smsNotifications")}</span>
          <input
            type="checkbox"
            checked={preferences.smsNotifications}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                smsNotifications: event.target.checked,
              }))
            }
          />
        </label>

        <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <span>{tS("marketingEmails")}</span>
          <input
            type="checkbox"
            checked={preferences.marketingEmails}
            onChange={(event) =>
              setPreferences((prev) => ({
                ...prev,
                marketingEmails: event.target.checked,
              }))
            }
          />
        </label>

        {preferencesMessage ? (
          <p className="text-sm text-muted">{preferencesMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={handlePreferencesSave}
          disabled={isSavingPreferences}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {isSavingPreferences ? tS("saving") : tS("savePreferences")}
        </button>
      </PanelCard>

      <PanelCard className="space-y-4">
        <h2 className="text-lg font-semibold">{tS("securityTitle")}</h2>
        <p className="text-sm text-muted">{tS("securityDescription")}</p>

        <div>
          <FormLabel htmlFor="settings-current-password">{tS("currentPassword")}</FormLabel>
          <FormInput
            id="settings-current-password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-new-password">{tS("newPassword")}</FormLabel>
          <FormInput
            id="settings-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div>
          <FormLabel htmlFor="settings-confirm-password">{tS("confirmPassword")}</FormLabel>
          <FormInput
            id="settings-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {passwordMessage ? <p className="text-sm text-muted">{passwordMessage}</p> : null}

        <button
          type="button"
          onClick={handlePasswordSave}
          disabled={isChangingPassword}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {isChangingPassword ? tS("updating") : tS("changePassword")}
        </button>
      </PanelCard>

      <PanelCard className="space-y-4 border border-error/40">
        <h2 className="text-lg font-semibold text-error">{tDelete("title")}</h2>
        <p className="text-sm text-muted">{tDelete("description")}</p>

        <div>
          <FormLabel htmlFor="settings-delete-confirm">
            {tDelete("confirmLabel", { word: tDelete("confirmWord") })}
          </FormLabel>
          <FormInput
            id="settings-delete-confirm"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
          />
        </div>

        {deleteMessage ? <p className="text-sm text-error">{deleteMessage}</p> : null}

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={isDeletingAccount}
          className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90 disabled:opacity-60"
        >
          {isDeletingAccount ? tDelete("deleting") : tDelete("submit")}
        </button>
      </PanelCard>
    </div>
  );
}
