import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Typography from '@mui/material/Typography';
import { dashboardGreen } from '../utils/constants';

interface collapsibleSectionProps {
    title: string;
    content: React.ReactNode;
    defaultExpanded?: boolean;
}

const CollapsibleSection = (props: collapsibleSectionProps) => {

    return (
            <Accordion square={false}  sx={{ borderRadius: '12px', '&:before': { display: 'none' }}} defaultExpanded={props.defaultExpanded}>
                <AccordionSummary
                    expandIcon={<span className="text-xl font-bold text-white">↓</span>}
                    aria-controls="panel1-content"
                    id="panel1-header"
                    sx={{
                        backgroundColor: dashboardGreen,
                        color: "white",
                    }}
                >
                    <Typography component="span">{props.title}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{color: "black"}}>
                    {props.content}
                </AccordionDetails>
            </Accordion>
    )
}

export default CollapsibleSection;