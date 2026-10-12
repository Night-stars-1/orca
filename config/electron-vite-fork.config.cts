import configureElectronVite, { electronViteConfig } from '../electron.vite.config'
import { applyReleaseRepoDefine } from './build-plugins/release-repo-define'

// Keep fork definitions out of the upstream config so rebases do not replay a shared-file patch.
applyReleaseRepoDefine(electronViteConfig)

export default configureElectronVite
