'use client'
import { useDocsSearch } from 'fumadocs-core/search/client'
import { staticClient } from 'fumadocs-core/search/client/orama-static'
import {
  SearchDialog,
  SearchDialogClose,
  SearchDialogContent,
  SearchDialogHeader,
  SearchDialogIcon,
  SearchDialogInput,
  SearchDialogList,
  SearchDialogOverlay,
} from 'fumadocs-ui/components/dialog/search'
import type { SharedProps } from 'fumadocs-ui/contexts/search'

const client = staticClient({ from: '/docs/api/search' })

export default function StaticSearch(props: SharedProps) {
  const search = useDocsSearch({ client })
  return (
    <SearchDialog {...search} {...props}>
      <SearchDialogOverlay />
      <SearchDialogContent>
        <SearchDialogHeader>
          <SearchDialogIcon />
          <SearchDialogInput />
          <SearchDialogClose />
        </SearchDialogHeader>
        <SearchDialogList />
      </SearchDialogContent>
    </SearchDialog>
  )
}
