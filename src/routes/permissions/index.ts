// Export all permission-related routes
import setPermission from './setPermission.js'
import getPermission from './getPermission.js'
import getQuote from './getQuote.js'
import setBoxWidePermission from './setBoxWidePermission.js'
import listPermissions from './listPermissions.js'

export const permissionRoutes = [
  setPermission,
  getPermission,
  getQuote,
  setBoxWidePermission,
  listPermissions
]
