/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';

/**
 * WordPress dependencies
 */
import { __experimentalBlockAlignmentVisualizer as BlockAlignmentVisualizer } from '@wordpress/block-editor';
import { ResizableBox } from '@wordpress/components';
import { isRTL } from '@wordpress/i18n';

export default function ResizableImageControls( {
	align,
	children,
	clientId,
	minWidth,
	maxWidth,
	minHeight,
	maxHeight,
	showHandle,
	onResizeStart,
	onResizeStop,
	size,
} ) {
	let showRightHandle = false;
	let showLeftHandle = false;
	const [ isResizingImage, setIsResizingImage ] = useState( false );
	const [ mousePosition, setMousePosition ] = useState();

	/* eslint-disable no-lonely-if */
	// See https://github.com/WordPress/gutenberg/issues/7584.
	if ( align === 'center' ) {
		// When the image is centered, show both handles.
		showRightHandle = true;
		showLeftHandle = true;
	} else if ( isRTL() ) {
		// In RTL mode the image is on the right by default.
		// Show the right handle and hide the left handle only when it is
		// aligned left. Otherwise always show the left handle.
		if ( align === 'left' ) {
			showRightHandle = true;
		} else {
			showLeftHandle = true;
		}
	} else {
		// Show the left handle and hide the right handle only when the
		// image is aligned right. Otherwise always show the right handle.
		if ( align === 'right' ) {
			showLeftHandle = true;
		} else {
			showRightHandle = true;
		}
	}
	/* eslint-enable no-lonely-if */

	return (
		<>
			{ isResizingImage && (
				<BlockAlignmentVisualizer
					clientId={ clientId }
					allowedAlignments={ [ 'none', 'wide', 'full' ] }
					showNearestAlignmentToCoords={ mousePosition }
				/>
			) }
			<ResizableBox
				size={ size }
				showHandle={ showHandle }
				minWidth={ minWidth }
				maxWidth={ maxWidth }
				minHeight={ minHeight }
				maxHeight={ maxHeight }
				lockAspectRatio
				enable={ {
					top: false,
					right: showRightHandle,
					bottom: true,
					left: showLeftHandle,
				} }
				onResizeStart={ ( ...resizeArgs ) => {
					onResizeStart( ...resizeArgs );
					setIsResizingImage( true );
				} }
				onResize={ ( event ) => {
					setMousePosition( { x: event.clientX, y: event.clientY } );
				} }
				onResizeStop={ ( ...resizeArgs ) => {
					onResizeStop( ...resizeArgs );
					setIsResizingImage( false );
				} }
			>
				{ children }
			</ResizableBox>
		</>
	);
}
