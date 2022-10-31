/**
 * External dependencies
 */
import classnames from 'classnames';

/**
 * WordPress dependencies
 */
import { getBlockSupport, hasBlockSupport } from '@wordpress/blocks';
import { Popover } from '@wordpress/components';
import { useMergeRefs, useRefEffect } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import {
	createPortal,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { BlockList } from '../';
import { useLayout, LayoutStyle } from '../block-list/layout';
import { __unstableUseBlockElement as useBlockElement } from '../block-list/use-block-props/use-block-refs';
import useAvailableAlignments from '../block-alignment-control/use-available-alignments';
import { store as blockEditorStore } from '../../store';
import { getValidAlignments } from '../../hooks/align';
import { getDistanceToNearestEdge } from '../../utils/math';

const highlightedZoneEdges = [ 'right' ];
function detectNearestZone( point, zones ) {
	let candidateZone;
	let candidateDistance;

	zones?.forEach( ( zone ) => {
		const [ distance ] = getDistanceToNearestEdge(
			point,
			zone.node.getBoundingClientRect(),
			highlightedZoneEdges
		);

		if ( ! candidateDistance || candidateDistance > distance ) {
			candidateDistance = distance;
			candidateZone = zone;
		}
	} );

	return candidateZone;
}

export default function BlockAlignmentVisualizer( {
	allowedAlignments,
	clientId,
	showNearestAlignmentToCoords,
} ) {
	const layout = useLayout();
	const { blockName, parentClientId, parentBlockName } = useSelect(
		( select ) => {
			const { getBlockName, getBlockRootClientId } =
				select( blockEditorStore );

			const rootClientId = getBlockRootClientId( clientId );

			return {
				blockName: getBlockName( clientId ),
				parentClientId: rootClientId,
				parentBlockName: getBlockName( rootClientId ),
			};
		},
		[ clientId ]
	);

	const [ popoverAnchor, setPopoverAnchor ] = useState( null );
	const [ coverElementStyle, setCoverElementStyle ] = useState( null );
	const [ highlightedZone, setHighlightedZone ] = useState();
	const zones = useRef( new Set() );
	const blockElement = useBlockElement( clientId );
	const parentBlockElement = useBlockElement( parentClientId );
	const rootBlockListElement = useContext(
		BlockList.__unstableElementContext
	);

	useEffect( () => {
		if ( showNearestAlignmentToCoords ) {
			const nearestZone = detectNearestZone(
				showNearestAlignmentToCoords,
				zones.current
			);
			if ( nearestZone?.name !== highlightedZone ) {
				setHighlightedZone( nearestZone?.name );
			}
		}
	}, [ showNearestAlignmentToCoords ] );

	useEffect( () => {
		const parentElement = parentBlockElement ?? rootBlockListElement;
		if ( ! blockElement || ! parentElement ) {
			return;
		}

		const { ownerDocument } = blockElement;
		const { defaultView } = ownerDocument;

		const update = () => {
			setPopoverAnchor( {
				ownerDocument,
				getBoundingClientRect() {
					const parentRect = parentElement.getBoundingClientRect();
					const blockRect = blockElement.getBoundingClientRect();

					// Produce a rect that has:
					// - the horizontal positioning/height of the parent block.
					// - the vertical positioning/height of the current block.
					//
					// These are the dimensions of our fake 'block list'.
					return new defaultView.DOMRect(
						parentRect.x,
						blockRect.y,
						parentRect.width,
						blockRect.height
					);
				},
			} );

			setCoverElementStyle( {
				position: 'absolute',
				width: parentElement.offsetWidth,
				height: blockElement.offsetHeight,
			} );
		};

		const resizeObserver = defaultView.ResizeObserver
			? new defaultView.ResizeObserver( update )
			: undefined;
		resizeObserver?.observe( parentElement );
		resizeObserver?.observe( blockElement );
		update();

		return () => {
			resizeObserver?.disconnect();
		};
	}, [ blockElement, parentBlockElement, rootBlockListElement ] );

	const blockAllowedAlignments = getValidAlignments(
		getBlockSupport( blockName, 'align' ),
		hasBlockSupport( blockName, 'alignWide', true )
	);

	// Allow override of `blockAllowedAlignments`. The image block doesn't use
	// alignment block supports, so this allows the image block to directly
	// declare what it supports.
	const availableAlignments = useAvailableAlignments(
		allowedAlignments ?? blockAllowedAlignments
	);

	const alignments = useMemo( () => {
		return availableAlignments
			.map( ( { name } ) => {
				if ( name === 'none' ) {
					return {
						name,
						label: __( 'Content width' ),
					};
				}
				if ( name === 'wide' ) {
					return {
						name,
						label: __( 'Wide width' ),
						className: 'alignwide',
					};
				}
				if ( name === 'full' ) {
					return {
						name,
						label: __( 'Full width' ),
						className: 'alignfull',
					};
				}
				return null;
			} )
			.filter( ( alignment ) => alignment !== null );
	}, [ availableAlignments, layout ] );

	const contrastColor = useMemo( () => {
		if ( ! blockElement ) {
			return;
		}

		return blockElement.ownerDocument.defaultView
			.getComputedStyle( blockElement )
			.getPropertyValue( 'color' );
	}, [ blockElement ] );

	const popoverRef = useRef();

	if ( availableAlignments?.length === 0 ) {
		return null;
	}

	return (
		<Popover
			ref={ popoverRef }
			anchor={ popoverAnchor }
			placement="top-start"
			className="block-editor__alignment-visualizer"
			animate={ false }
			focusOnMount={ false }
			flip={ false }
			resize={ false }
			__unstableSlotName=""
		>
			<Iframe
				style={ coverElementStyle }
				className="block-editor__alignment-visualizer-iframe"
			>
				<head>
					<style>
						{ `
							:root {
								--contrast-color: ${ contrastColor }
							}

							html {
								overflow: hidden;
							}

							body::before {
								content: "";
								position: absolute;
								top: 0;
								right: 0;
								bottom: 0;
								left: 0;
								background-color: var(--contrast-color);
								opacity: 0.1;
							}

							.block-editor__alignment-visualizer-zone {
								position: absolute;
								top: 0;
								bottom: 0;
								left: 0;
								right: 0;
							}

							.block-editor__alignment-visualizer-zone-inner {
								height: 100%;
								max-width: 100%;
								margin: 0 auto;
								opacity: 0.7;
								border-left: solid 2px var(--contrast-color);
								border-right: solid 2px var(--contrast-color);
							}
						` }
					</style>
					<LayoutStyle
						blockName={ parentBlockName }
						layout={ layout }
						selector=".block-editor__alignment-visualizer-zone"
					/>
				</head>
				<body className="editor-styles-wrapper">
					{ alignments.map( ( alignment ) => (
						<BlockAlignmentVisualizerZone
							key={ alignment.name }
							alignment={ alignment }
							justification={ layout.justifyContent }
							color={ contrastColor }
							isHighlighted={ alignment.name === highlightedZone }
							addZone={ ( zone ) => zones.current.add( zone ) }
							removeZone={ ( zone ) =>
								zones.current.delete( zone )
							}
						/>
					) ) }
				</body>
			</Iframe>
		</Popover>
	);
}

function BlockAlignmentVisualizerZone( {
	alignment,
	justification,
	color,
	isHighlighted,
	addZone,
	removeZone,
} ) {
	const [ popoverAnchor, setPopoverAnchor ] = useState( null );
	const { name } = alignment;

	const updateZonesRef = useRefEffect(
		( node ) => {
			const zone = {
				name,
				node,
			};
			addZone( zone );
			return () => removeZone( zone );
		},
		[ name ]
	);

	const zoneInnerRefs = useMergeRefs( [ updateZonesRef, setPopoverAnchor ] );

	return (
		<>
			<div
				className={ classnames(
					'block-editor__alignment-visualizer-zone',
					{
						[ `is-content-justification-${ justification }` ]:
							justification,
					}
				) }
			>
				<div
					className={ classnames(
						'block-editor__alignment-visualizer-zone-inner',
						alignment.className
					) }
					ref={ zoneInnerRefs }
				/>
			</div>
			<Popover
				anchor={ popoverAnchor }
				className="block-editor__alignment-visualizer-zone-label-popover"
				placement="top-end"
				variant="unstyled"
				flip
			>
				<div
					className={ classnames(
						'block-editor__alignment-visualizer-zone-label',
						{ 'is-highlighted': isHighlighted }
					) }
					style={ { color } }
				>
					{ alignment.label }
				</div>
			</Popover>
		</>
	);
}

function Iframe( { children, ...props } ) {
	const [ iframeDocument, setIframeDocument ] = useState( null );

	const ref = useRefEffect( ( node ) => {
		function setDocumentIfReady() {
			const contentDocument = node?.contentDocument;
			const documentElement = contentDocument?.documentElement;
			const readyState = contentDocument?.readyState;

			if ( readyState !== 'interactive' && readyState !== 'complete' ) {
				return;
			}

			documentElement.removeChild( contentDocument.head );
			documentElement.removeChild( contentDocument.body );
			setIframeDocument( documentElement );
		}

		node.addEventListener( 'load', setDocumentIfReady );

		return () => {
			node.removeEventListener( 'load', setDocumentIfReady );
			setIframeDocument( null );
		};
	}, [] );

	return (
		<iframe
			ref={ ref }
			// Correct doctype is required to enable rendering in standards mode
			srcDoc="<!doctype html>"
			title={ __( 'Alignment visualizer' ) }
			{ ...props }
		>
			{ iframeDocument && createPortal( children, iframeDocument ) }
		</iframe>
	);
}
