// marp-engine-with-fragment-directive.mjs
const defaultFragmentState = true // Default state (You can change it if needed)

const fragmentDirectivePlugin = (md) => {
    // Define `fragment` local directive to control fragments
    md.marpit.customDirectives.local.fragment = (value) => {
        const normalized = (value || '').toLowerCase()

        // Set fragment state as boolean if the value can recognize as boolean, and ignore otherwise
        if (normalized === 'true' || normalized === 'false')
            return { fragment: normalized === 'true' }

        return {}
    }

    // markdown-it cannot turn on and off a rule by condition while rendering, so
    // add a new rule to remove already assigned fragment state instead of turning
    // off the rule for the fragmented list.
    md.core.ruler.after('marpit_fragment', 'remove_marpit_fragment', (state) => {
        if (state.inlineMode) return

        let fragmentEnabled = defaultFragmentState


        for (const token of state.tokens) {

            // Recognize the state of `fragment` directive
            if (
                typeof token.meta?.marpitSlide === 'number' &&
                typeof token.meta.marpitDirectives === 'object'
            ) {
                fragmentEnabled =
                    'fragment' in token.meta.marpitDirectives
                        ? token.meta.marpitDirectives.fragment
                        : defaultFragmentState
            }



            // Remove `marpitFragment` meta from list item
            if (
                !fragmentEnabled &&
                token.type === 'list_item_open' &&
                token.meta?.marpitFragment
            ) {
                token.meta.marpitFragment = false
            }

        }
    })
}

export default ({ marp }) => marp.use(fragmentDirectivePlugin)


// const IS_SHOW_FRAGMENT = false // 是否显示碎片（list的分隔动画，一般而言在html显示为data-marpit-fragment），全局禁用


// export default ({ marp }) =>
//     marp.use((md) => {
//         // 根据IS_SHOW_FRAGMENT判断：false时禁用碎片动画，true时保留
//         if (!IS_SHOW_FRAGMENT) {
//             md.core.ruler.disable('marpit_fragment');
//         }
//     });

// // usage:marp --engine marp-engine-with-disable-fragment.mjs your-markdown.md