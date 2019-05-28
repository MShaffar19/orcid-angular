export interface ApplicationMenuItem {
  id: string
  label: string
  route?: string
  hover: boolean
  active: boolean
  hideOnDesktop?: boolean
  hideOnHandset?: boolean
  buttons?: ApplicationMenuItem[]
}

export interface ApplicationMenuItemBasic {
  id: string
  label: string
  route?: string
  buttons?: ApplicationMenuItemBasic[]
  hideOnDesktop?: boolean
  hideOnHandset?: boolean
}
