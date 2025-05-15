import '@electron-toolkit/preload'

import { contextBridge, ipcRenderer } from 'electron'

interface Shortcut {
  id: string
  command: string
}

enum IPCHandler {
  FindCarThing = 'findCarThing',
  FindSetupCarThing = 'findSetupCarThing',
  InstallApp = 'installApp',
  StartServer = 'startServer',
  StopServer = 'stopServer',
  IsServerStarted = 'isServerStarted',
  ForwardSocketServer = 'forwardSocketServer',
  GetVersion = 'getVersion',
  GetStorageValue = 'getStorageValue',
  SetStorageValue = 'setStorageValue',
  TriggerCarThingStateUpdate = 'triggerCarThingStateUpdate',
  UploadShortcutImage = 'uploadShortcutImage',
  RemoveNewShortcutImage = 'removeNewShortcutImage',
  GetShortcuts = 'getShortcuts',
  AddShortcut = 'addShortcut',
  RemoveShortcut = 'removeShortcut',
  UpdateShortcut = 'updateShortcut',
  IsDevMode = 'isDevMode',
  setSpotifyCID = 'setClientID',
  setSpotiftyCS = 'setClientSecret',
  SetSpotifyToken = 'setSpotifyToken',
  getSpotifyCID = 'getSpotifyCID',
  getSpotifyCS = 'getSpotifyCID',
  openSpotifyLogin = 'openSpotifyLogin',
  GetBrightness = 'getBrightness',
  SetBrightness = 'setBrightness',
  GetPatches = 'getPatches',
  ApplyPatch = 'applyPatch',
  setCity = 'setCity',
  getCity = 'getCity'
}

// Custom APIs for renderer
const api = {
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    const _listener = (_event, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, _listener)

    return () => ipcRenderer.removeListener(channel, _listener)
  },
  findCarThing: () => ipcRenderer.invoke(IPCHandler.FindCarThing),
  findSetupCarThing: () =>
    ipcRenderer.invoke(IPCHandler.FindSetupCarThing),
  installApp: () => ipcRenderer.invoke(IPCHandler.InstallApp),
  startServer: () => ipcRenderer.invoke(IPCHandler.StartServer),
  stopServer: () => ipcRenderer.invoke(IPCHandler.StopServer),
  isServerStarted: () => ipcRenderer.invoke(IPCHandler.IsServerStarted),
  forwardSocketServer: () =>
    ipcRenderer.invoke(IPCHandler.ForwardSocketServer),
  getVersion: () => ipcRenderer.invoke(IPCHandler.GetVersion),
  getStorageValue: (key: string) =>
    ipcRenderer.invoke(IPCHandler.GetStorageValue, key),
  setStorageValue: (key: string, value: unknown) =>
    ipcRenderer.invoke(IPCHandler.SetStorageValue, key, value),
  triggerCarThingStateUpdate: () =>
    ipcRenderer.invoke(IPCHandler.TriggerCarThingStateUpdate),
  uploadShortcutImage: (name: string) =>
    ipcRenderer.invoke(IPCHandler.UploadShortcutImage, name),
  removeNewShortcutImage: () =>
    ipcRenderer.invoke(IPCHandler.RemoveNewShortcutImage),
  getShortcuts: () => ipcRenderer.invoke(IPCHandler.GetShortcuts),
  addShortcut: (shortcut: Shortcut) =>
    ipcRenderer.invoke(IPCHandler.AddShortcut, shortcut),
  removeShortcut: (shortcut: Shortcut) =>
    ipcRenderer.invoke(IPCHandler.RemoveShortcut, shortcut),
  updateShortcut: (shortcut: Shortcut) =>
    ipcRenderer.invoke(IPCHandler.UpdateShortcut, shortcut),
  isDevMode: () => ipcRenderer.invoke(IPCHandler.IsDevMode),
  setSpotifyCID: (clientID: string) => 
    ipcRenderer.invoke(IPCHandler.setSpotifyCID, clientID),
  setSpotifyCS: (clientCS: string) => 
    ipcRenderer.invoke(IPCHandler.setSpotiftyCS, clientCS),
  openSpotifyLogin: () => 
    ipcRenderer.invoke(IPCHandler.openSpotifyLogin),
  setSpotifyToken: (token: string) =>
    ipcRenderer.invoke(IPCHandler.SetSpotifyToken, token),
  getSpotifyCID: () => ipcRenderer.invoke(IPCHandler.getSpotifyCID),
  getSpotifyCS: () => ipcRenderer.invoke(IPCHandler.getSpotifyCS),
  getBrightness: () => ipcRenderer.invoke(IPCHandler.GetBrightness),
  setBrightness: (brightness: number) =>
    ipcRenderer.invoke(IPCHandler.SetBrightness, brightness),
  getPatches: () => ipcRenderer.invoke(IPCHandler.GetPatches),
  applyPatch: (patchName: string) =>
    ipcRenderer.invoke(IPCHandler.ApplyPatch, patchName),
  getCity: () => ipcRenderer.invoke(IPCHandler.getCity),
  setCity: (city: string) => ipcRenderer.invoke(IPCHandler.setCity, city)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
