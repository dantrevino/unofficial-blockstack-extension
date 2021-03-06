import Vue from 'vue';
import { Module } from 'vuex';
import {
  signProfileToken,
  connectToGaiaHub,
  Person,
  uploadToGaiaHub,
  GaiaHubConfig,
  wrapProfileToken,
  resolveZoneFileToProfile
} from 'blockstack';
import { IdentityStateType, LocalIdentity } from './types/identity.state';
import { StateType } from './types/state';
import axios from 'axios';
import { parseZoneFile } from 'zone-file';
import { verifyProfileTokenRecord } from '../../token-util';

function makeState(): IdentityStateType {
  return {
    default: 0,
    localIdentities: [],
    createProfileError: null
  };
}

function tryUpload(url: string, data: any, hubConfig: GaiaHubConfig, mimeType?: string) {
  const readPrefix = `${hubConfig.url_prefix}${hubConfig.address}/`;
  if(!url.startsWith(readPrefix)) return Promise.reject(new Error(`Url doesn't start with the right prefix!`));
  else url = url.substring(readPrefix.length);
  return uploadToGaiaHub(url, data, hubConfig, mimeType);
}

export const identityModule: Module<IdentityStateType, StateType> = {
  namespaced: true,
  state: makeState(),
  mutations: {
    reset(state) {
      Object.assign(state, makeState());
    },
    setDefault(state, { index }: { index: number }) {
      if(index === 0 || (index > 0 && index < state.localIdentities.length))
        state.default = index;
    },
    create(state, payload: Partial<LocalIdentity> & { ownerAddress: string }) {
      state.localIdentities.push(Object.assign({}, new LocalIdentity(payload.ownerAddress), payload));
    },
    update(state, { index, payload }: { index: number, payload: Partial<LocalIdentity> }) {
      if(!(state.localIdentities[index] && state.localIdentities[index].ownerAddress)) {
        console.error(`Can't update local identity at index ${index}; it doesn't exist (or doesn't have an ownerAddress)!`);
        return;
      }
      Vue.set(state.localIdentities, index, Object.assign(
        {},
        state.localIdentities[index],
        payload));
    },
    updateApp(state, { index, domain, payload }: { index: number, domain: string, payload: any }) {
      if(!(state.localIdentities[index] && state.localIdentities[index].ownerAddress)) {
        console.error(`Can't update local identitiy's apps at index ${index}; it doesn't exist (or doesn't have an ownerAddress)!`);
        return;
      }
      if(!state.localIdentities[index].profile.apps)
        Vue.set(state.localIdentities[index].profile, 'apps', { [domain]: payload });
      else
        Vue.set(state.localIdentities[index].profile.apps, domain, payload);
    },
    remove(state, { index }: { index: number }) {
      if(index >= state.localIdentities.length || index <= 0)
        return;

      const ids = state.localIdentities;
      const newIds = ids.slice(0, index).concat(ids.slice(index + 1));
      state.localIdentities.splice(0, ids.length, ...newIds);

      if(state.default >= state.localIdentities.length)
        state.default = state.localIdentities.length - 1;
      if(state.default < 0) state.default = 0;
    },
    addProfileImage(state, { index, payload }: { index?: number, payload: any }) {
      index = index || state.default;
      if(!state.localIdentities[index] || !state.localIdentities[index].profile) {
        console.error('No profile for index ' + index + ' to upload image to.');
        return;
      }

      state.localIdentities[index].profile.image.push(Object.assign({
        '@type': 'ImageObject',
        name: '',
        contentUrl: ''
      }, payload));
    }
  },
  getters: {
    defaultId: (state) => {
      const id = state.localIdentities[state.default];
      if(!id) return '{null}';
      if(id.username) return id.username;
      if(id.profile && id.profile.name) return `${id.profile.name}: ID-${id.ownerAddress}`;
      return `ID-${id.ownerAddress}`;
    },
    getZoneFile: (state) => (index?: number) => {
      index = index || state.default;
      if(!state.localIdentities[index]) return null;
      return state.localIdentities[index].zoneFile;
    },
    getTokenFileUrl: (state, getters) => (index?: number) => {
      const zoneFile = getters.getZoneFile(index);
      if(!zoneFile) return null;

      let parsed: any;
      try {
        parsed = parseZoneFile(zoneFile)
      } catch(e) {
        return null;
      }
      if(!parsed['uri'] || !(parsed.uri instanceof Array) || parsed.uri.length <= 0)
        return null;

      const first = parsed.uri[0];

      if(!first['target'])
        return null;

      const tokenFileUrl: string = first.target;

      if(!(tokenFileUrl.startsWith('https') || tokenFileUrl.startsWith('http')))
        return `https://${tokenFileUrl}`;
      else return tokenFileUrl;
    }
  },
  actions: {
    reset({ commit }) {
      commit('reset');
    },
    async getDefaultProfileUrl({ state, rootState }, payload: { index?: number }) {
      let index;
      if(!payload || !payload.index) index = state.default;
      else index = payload.index;

      const identity = state.localIdentities[index];
      let ownerAddress: string;
      if(identity)
        ownerAddress = identity.ownerAddress;
      else
        ownerAddress = rootState.account.identityAccount.addresses[index];
      return rootState.settings.api.gaiaUrlBase + '/' + ownerAddress + '/profile.json';
    },
    async getProfileUploadLocation({ state, getters, rootState }, payload: { index?: number }) {
      let index;
      if(!payload || !payload.index) index = state.default;
      else index = payload.index;

      const zoneFile = getters.getZoneFile(index)
      const gaiaHubConfig = rootState.settings.api.gaiaHubConfig;
      if(!zoneFile) return gaiaHubConfig.url_prefix + gaiaHubConfig.address + '/profile.json';
      else return getters.getTokenFileUrl(index);
    },
    async resolveProfile({ state, getters, rootState }, { publicKeyOrAddress }: { publicKeyOrAddress: string }) {
      const zoneFile = getters.getZoneFile();
      const tokenFileUrl = getters.getTokenFileUrl();

      if(!zoneFile) { // don't catch errors I guess
        let profile = JSON.parse(zoneFile);
        profile = Person.fromLegacyFormat(profile).profile();
        return profile;
      }

      if(!tokenFileUrl) {
        console.warn('No token file url to resolve profile with!');
        return { };
      }

      try {
        return await axios.get(tokenFileUrl).then(res => {
          const profile = { }
          const tokenRecords: any[] = res.data;
          for(const tokenRecord of tokenRecords) {
            let decodedToken
            try {
              decodedToken = verifyProfileTokenRecord(tokenRecord, publicKeyOrAddress);
            } catch(e) { console.warn('Error decoding token:', e); }

            if(decodedToken !== null)
              Object.assign(profile, decodedToken.payload.claim);
          }
          return profile;
        });
      } catch(e) {
        console.error('Error fetching token file:', e)
        return { };
      }
    },
    async downloadProfiles({ commit, state, dispatch, rootState }, { index }: { index?: number }) {
      index = index || state.default;
      const gaiaUrlBase = rootState.settings.api.gaiaUrlBase;
      const firstAddress = rootState.account.identityAccount.keypairs[0].address;
      const ownerAddress = rootState.account.identityAccount.keypairs[index].address;

      const urls: string[] = [ await dispatch('getDefaultProfileUrl', { index }) ];

      if(index < 2) {
        urls.push(gaiaUrlBase + '/' + firstAddress + '/' + ownerAddress + '/profile.json');
      } else if (index % 2 === 1) {
        const buggedIndex = 1 + Math.floor(index / 2); // apparently, blockstack counts in odd integers
        urls.push(gaiaUrlBase + '/' + firstAddress + '/' + buggedIndex + '/profile.json');
      }

      for(const url of urls) {
        try {
          const res = await axios.get(url)
          const profile = { };
          for(const tokenRecord of res.data) {
            const decodedToken = verifyProfileTokenRecord(tokenRecord, ownerAddress);
            Object.assign(profile, decodedToken.payload.claim);
          }
          return { profile, profileUrl: url };
        } catch(e) {
          console.warn('Error downloading profile data from "' + url + '": ', e);
        }
      }
      console.warn('No profile data found...');
      return;
    },
    download({ commit, state, dispatch, rootState}, { address, index }: { address?: string, index: number }) {
      const addr = address || rootState.account.identityAccount.addresses[index];
      if(!state.localIdentities[index])
        commit('create', { ownerAddress: addr });
      const url = rootState.settings.api.bitcoinAddressLookupUrl.replace('{address}', addr);
      return axios.get(url).then(res => {
        if(res.data.names.length === 0) {
          console.log('Address ' + addr + 'has no names, checking default locations.');
          return dispatch('downloadProfiles', { index: index }).then((data?: any) => {
            if(!(data && data.profile)) throw new Error('No profile data found!');
            commit('update', { index: index, payload: { profile: data.profile, zoneFile: '' } });
          }, e => console.error('Error fetching info for address ' + addr + ':', e));
        } else {
          if(res.data.names.length > 1) console.warn('Address ' + addr + ' has multiple names; only using the first!');
          commit('update', {
            index: index,
            payload: { username: res.data.names[0], usernames: res.data.names, usernamePending: false, usernameOwned: true }
          });

          /** Make it so it falls-back to other usernames */
          const lookupUrl = rootState.settings.api.nameLookupUrl.replace('{name}', res.data.names[0]);
          return axios.get(lookupUrl).then(lookupRes => {
            if(!lookupRes.data || !lookupRes.data.zonefile || !lookupRes.data.address) {
              console.warn(`Malformed return from lookup url: (${lookupRes.status}) ${lookupRes.statusText}!`);
              throw new Error('Bad response from lookup url!');
            }
            return resolveZoneFileToProfile(lookupRes.data.zonefile, lookupRes.data.address).then(profile => {
              if(!profile) throw new Error('No profile data found!');
              commit('update', { index: index, payload: { profile, zoneFile: lookupRes.data.zonefile} });
            })
          });
        }
      });
    },
    downloadAll({ dispatch, rootState }) {
      return Promise.all(rootState.account.identityAccount.addresses
        .map((address, index) => dispatch('download', { address, index }))
        .map(p => p.then(() => true, () => false)));
    },
    async upload({ dispatch, state, rootState }, { index }: { index?: number }) {
      index = index || state.default;
      const keypair = rootState.account.identityAccount.keypairs[index];
      if(!keypair) throw new Error('No keypair in the index ' + index + '!');

      const identityHubConfig = await connectToGaiaHub(rootState.settings.api.gaiaHubUrl, keypair.key);
      const globalHubConfig = rootState.settings.api.gaiaHubConfig;

      const url: string = await dispatch('getProfileUploadLocation');
      const profile = state.localIdentities[index].profile;
      const token = signProfileToken(profile, keypair.key);
      const tokenRecords = [ wrapProfileToken(token) ];

      const signedProfileData = JSON.stringify(tokenRecords, null, 2);

      return tryUpload(url, signedProfileData, identityHubConfig, 'application/json')
          .catch(() => tryUpload(url, signedProfileData, globalHubConfig, 'application/json'))
          .catch(e => Promise.reject(new Error(`Issue writing to ${url}: ` + e)));
    },
    async uploadProfileImage({ commit, dispatch, state, rootState },
      { index, photoFile, photoName }: { index?: number, photoFile: string, photoName?: string}) {
      index = index || state.default;
      photoName = photoName || 'avatar-0';
      const keypair = rootState.account.identityAccount.keypairs[index];
      if(!keypair) throw new Error('No keypair in the index ' + index + '!');
      if(!state.localIdentities[index]) throw new Error('No local identity in the index ' + index + '!');
      if(!state.localIdentities[index].profile) throw new Error('No profile in the identity at index ' + index + '!');

      const identityHubConfig = await connectToGaiaHub(rootState.settings.api.gaiaHubUrl, keypair.key);

      let profileUploadLoc: string = await dispatch('getProfileUploadLocation', { index });
      if(profileUploadLoc.endsWith('profile.json'))
        profileUploadLoc = profileUploadLoc.substr(0, profileUploadLoc.length - 'profile.json'.length);
      else
        throw new Error(`Can't determine profile-photo storage location (no profile.json in upload location): ${profileUploadLoc}`);

      const url = profileUploadLoc + '/' + photoName;
      return tryUpload(url, photoFile, identityHubConfig)
        .catch(() => tryUpload(url, photoFile, rootState.settings.api.gaiaHubConfig))
        .then(() => {
          commit('addProfileImage', { index, payload: { name: photoName.replace(/-\d+$/, ''), contentUrl: url }});
          return dispatch('upload', { index });
        }, e => Promise.reject(new Error(`Issue writing to ${url}: ` + e)));
    }
  }
}

export default identityModule;
