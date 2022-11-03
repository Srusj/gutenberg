/**
 * WordPress dependencies
 */
import { useCallback } from '@wordpress/element';
import { getBlockType, parse } from '@wordpress/blocks';
import { useDispatch, useRegistry } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { store as blockEditorStore } from '../../store';

/**
 * Determine if the copied text looks like serialized blocks or not.
 *
 * @param {string} text The copied text.
 * @return {boolean} True if the text looks like serialized blocks, false otherwise.
 */
function looksLikeBlocks( text ) {
	try {
		const blocks = parse( text, {
			__unstableSkipMigrationLogs: true,
			__unstableSkipAutop: true,
		} );
		if ( blocks.length === 1 && blocks[ 0 ].name === 'core/freeform' ) {
			// It's likely that the text is just plain text and not serialized blocks.
			return false;
		}
		return true;
	} catch ( err ) {
		// Parsing error, the text is not serialized blocks.
		// (Even though that it technically won't happen)
		return false;
	}
}

/**
 * Get the "style attributes" from a given block.
 * A "style attribute" is an attribute that doesn't have `__experimentalRole` of `content`.
 *
 * @param {WPBlock} block The input block.
 * @return {Object} the filtered attributes object.
 */
function getStyleAttributes( block ) {
	const blockType = getBlockType( block.name );
	const attributes = {};
	for ( const [ attribute, attributeType ] of Object.entries(
		blockType.attributes
	) ) {
		// Mark every attribute that isn't "content" as a style attribute.
		if ( attributeType.__experimentalRole !== 'content' ) {
			// Apply all attributes even when they are undefined to allow overriding styles.
			attributes[ attribute ] = Object.hasOwn(
				block.attributes,
				attribute
			)
				? block.attributes[ attribute ]
				: attributeType.default;
		}
	}
	return attributes;
}

/**
 * Update the target blocks with style attributes recursively.
 *
 * @param {WPBlock[]} targetBlocks          The target blocks to be updated.
 * @param {WPBlock[]} sourceBlocks          The source blocks to get th style attributes from.
 * @param {Function}  updateBlockAttributes The function to update the attributes.
 */
function recursivelyUpdateBlockAttributes(
	targetBlocks,
	sourceBlocks,
	updateBlockAttributes
) {
	for (
		let index = 0;
		index < Math.min( sourceBlocks.length, targetBlocks.length );
		index += 1
	) {
		updateBlockAttributes(
			targetBlocks[ index ].clientId,
			getStyleAttributes( sourceBlocks[ index ] )
		);

		recursivelyUpdateBlockAttributes(
			targetBlocks[ index ].innerBlocks,
			sourceBlocks[ index ].innerBlocks,
			updateBlockAttributes
		);
	}
}

/**
 * A hook to return a pasteStyles event function for handling pasting styles to blocks.
 *
 * @return {Function} A function to update the styles to the blocks.
 */
export default function usePasteStyles() {
	const registry = useRegistry();
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { createSuccessNotice, createWarningNotice, createErrorNotice } =
		useDispatch( noticesStore );

	return useCallback(
		async ( targetBlocks ) => {
			let html = '';
			try {
				// `http:` sites won't have the clipboard property on navigator.
				if ( ! window.navigator.clipboard ) {
					createErrorNotice(
						__(
							'Reading from the clipboard is only available in secure contexts (HTTPS) in supporting browsers.'
						),
						{ type: 'snackbar' }
					);
					return;
				}

				html = await window.navigator.clipboard.readText();
			} catch ( error ) {
				// Possibly the permission is denied.
				createErrorNotice(
					__( 'Permission denied: Unable to read from clipboard.' ),
					{
						type: 'snackbar',
					}
				);
				return;
			}

			// Abort if the copied text is empty or doesn't look like serialized blocks.
			if ( ! html || ! looksLikeBlocks( html ) ) {
				createWarningNotice(
					__( "The copied data doesn't appear to be blocks." ),
					{
						type: 'snackbar',
					}
				);
				return;
			}

			const copiedBlocks = parse( html );

			if ( copiedBlocks.length === 1 ) {
				// Apply styles of the block to all the target blocks.
				registry.batch( () => {
					recursivelyUpdateBlockAttributes(
						targetBlocks,
						targetBlocks.map( () => copiedBlocks[ 0 ] ),
						updateBlockAttributes
					);
				} );
			} else {
				registry.batch( () => {
					recursivelyUpdateBlockAttributes(
						targetBlocks,
						copiedBlocks,
						updateBlockAttributes
					);
				} );
			}

			if ( targetBlocks.length === 1 ) {
				const title = getBlockType( targetBlocks[ 0 ].name )?.title;
				createSuccessNotice(
					sprintf(
						// Translators: Name of the block being pasted, e.g. "Paragraph".
						__( 'Pasted styles to %s.' ),
						title
					),
					{ type: 'snackbar' }
				);
			} else {
				createSuccessNotice(
					sprintf(
						// Translators: The number of the blocks.
						__( 'Pasted styles to %d blocks.' ),
						targetBlocks.length
					),
					{ type: 'snackbar' }
				);
			}
		},
		[
			registry.batch,
			updateBlockAttributes,
			createSuccessNotice,
			createWarningNotice,
			createErrorNotice,
		]
	);
}
