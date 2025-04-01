import { getBackendSrv } from "@grafana/runtime";
import { TabularResult, IpInfo } from "../../lib/types";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { getBackendUrl } from "../../constants";

interface RowDetailPanelProps {
  tabularResult: TabularResult;
  selectedRow: number | null;
  onClose: () => void;
  isOpen: boolean;
}

const buttonStyle = {
  backgroundColor: '#000',
  color: '#fff',
  padding: '5px 10px',
  borderRadius: '5px',
  cursor: 'pointer',
  border: '1px solid #fff',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '200px',
  display: 'inline-block',
  textAlign: 'center' as const,
  margin: '4px 4px',
  transition: 'background-color 0.2s',
  ':hover': {
    backgroundColor: '#333'
  }
};

const searchButtonStyle = {
  marginLeft: '8px',
  padding: '2px 8px',
  backgroundColor: 'transparent',
  border: '1px solid rgba(204, 204, 220, 0.4)',
  borderRadius: '4px',
  color: 'rgb(204, 204, 220)',
  cursor: 'pointer',
  fontSize: '12px'
};

function enrichmentsFor(column: string, value: string) {





  if (value.match(/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/)) {
    return <div>
      <a style={buttonStyle} href={`https://ipinfo.io/${value}`} target="_blank" rel="noopener noreferrer">View on ipinfo.io</a>
      <a style={buttonStyle} href={`https://whois.domaintools.com/${value}`} target="_blank" rel="noopener noreferrer">View on domaintools</a>
      <a style={buttonStyle} onClick={() => alert('Here you will redirected to the block IP page')}>Block IP</a>
      <EnrichedIP ip={value} />
    </div>
  }

  if (value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{6})? \+\d{4} UTC$/)) {
    const date = new Date(value);

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diff / (1000 * 60));

    let timeAgoText = '';
    if (diffInMinutes < 60) {
      timeAgoText = `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 1440) { // less than 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      timeAgoText = `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 10080) { // less than 7 days
      const days = Math.floor(diffInMinutes / 1440);
      timeAgoText = `${days} day${days === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 43800) { // less than 30.417 days (average month)
      const weeks = Math.floor(diffInMinutes / 10080);
      timeAgoText = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    } else if (diffInMinutes < 525600) { // less than 365 days
      const months = Math.floor(diffInMinutes / 43800);
      timeAgoText = `${months} month${months === 1 ? '' : 's'} ago`;
    } else {
      const years = Math.floor(diffInMinutes / 525600);
      timeAgoText = `${years} year${years === 1 ? '' : 's'} ago`;
    }

    return (<span>
      <br />
      &nbsp;<i>({timeAgoText})</i>
    </span>)
  }

  if (column === 'logline') {
    return <div>
      <a style={buttonStyle} onClick={() => alert('Here you will redirected to the Kibana page')}>Open in Kibana</a>
    </div>
  }

  if (value.toLowerCase() === "error" || value.toLowerCase() === "warn" || value.toLowerCase() === "notice" || value.toLowerCase() === "info" || value.toLowerCase() === "debug") {
    return <div>
      <a style={buttonStyle} onClick={() => alert('Here you will redirected to the metrics page')}>Show metrics</a>
    </div>
  }

  if (/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*\.[A-Z][a-zA-Z0-9_]*$/i.test(value)) {
    return <div>
      <a style={buttonStyle} href={"https://github.com/apache/hadoop"} target="_blank" rel="noopener noreferrer">Git</a>
      <a style={buttonStyle} href={`https://www.google.com/search?q=${value}`} target="_blank" rel="noopener noreferrer">Search on Google</a>
    </div>
  }

  return null;
}


function EnrichedIP(props: { ip: string }) {

  const [ipInfo, setIpInfo] = useState<IpInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (show) {
      getBackendSrv().fetch({
        url: getBackendUrl('enrich_ip'),
        method: 'POST',
        data: JSON.stringify({ ip: props.ip }),
        headers: {
          'Content-Type': 'application/json'
        },
        showErrorAlert: false
      }).subscribe({
        next: (response) => {

          const d = response.data as IpInfo;
          setIpInfo(d);

        },
        error: (error) => {
          setError(error.message);
        }
      });
    } else {
      setIpInfo(null);
    }
  }, [props.ip, show])

  const tableStyle = { border: '1px solid #ccc', borderCollapse: 'collapse' as const };
  const cellStyle = { padding: '8px', border: '1px solid #ccc' };
  const labelCellStyle = {
    ...cellStyle,
    fontWeight: 'bold',
    whiteSpace: 'nowrap' as const
  };

  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    return value;
  };

  return (
    <div>
      {error && <p>{error}</p>}
      {ipInfo === null ?
        <button style={buttonStyle} onClick={() => setShow(true)}>Show Enriched IP</button>
        :
        <div>
          <button style={buttonStyle} onClick={() => setShow(false)}>Hide Enriched IP</button>
          <table style={tableStyle}>
            <tbody>
              <tr><td style={labelCellStyle}>IP</td><td style={cellStyle}>{renderValue(ipInfo.ip)}</td></tr>
              <tr><td style={labelCellStyle}>Hostname</td><td style={cellStyle}>{renderValue(ipInfo.hostname)}</td></tr>
              <tr><td style={labelCellStyle}>ASN</td><td style={cellStyle}>
                {renderValue(ipInfo.asn)} {renderValue(ipInfo.asn_country)}
                {ipInfo.asn && (
                  <button
                    style={searchButtonStyle}
                    onClick={() => window.open(`https://www.asnlookup.com/asn/AS${ipInfo?.asn}`, '_blank')}
                  >
                    ASN Lookup
                  </button>
                )}
              </td></tr>
              <tr><td style={labelCellStyle}>Coordinates</td><td style={cellStyle}>{renderValue(ipInfo.longitude)}, {renderValue(ipInfo.latitude)}</td></tr>
              <tr><td style={labelCellStyle}>Country</td><td style={cellStyle}>
                {renderValue(ipInfo.country_long)}  ({renderValue(ipInfo.country_short)})
                {ipInfo.country_long !== null && (
                  <button
                    style={searchButtonStyle}
                    onClick={() => window.open(`https://www.cia.gov/the-world-factbook/countries/${ipInfo.country_long?.toLowerCase().replace(/\s+/g, '-')}/`, '_blank')}
                  >
                    CIA Factbook
                  </button>
                )}
              </td></tr>
              <tr><td style={labelCellStyle}>Region</td><td style={cellStyle}>{renderValue(ipInfo.region)}</td></tr>
              <tr><td style={labelCellStyle}>City</td><td style={cellStyle}>{renderValue(ipInfo.city)}</td></tr>

              <tr><td style={labelCellStyle}>ISP</td><td style={cellStyle}>
                {renderValue(ipInfo.isp)}
                {ipInfo.isp !== null && (
                  <>
                    <button
                      style={searchButtonStyle}
                      onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(ipInfo?.isp ?? '')}`, '_blank')}
                    >
                      Google Search
                    </button>
                    <button
                      style={searchButtonStyle}
                      onClick={() => window.open(`https://www.thecompaniesapi.com/`, '_blank')}
                    >
                      Companies API
                    </button>

                    <button
                      style={searchButtonStyle}
                      onClick={() => window.open(`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(ipInfo?.isp ?? '')}`, '_blank')}
                    >
                      LinkedIn Search
                    </button>

                    <button
                      style={searchButtonStyle}
                      onClick={() => window.open(`https://www.lusha.com/`, '_blank')}
                    >
                      Lusha Search
                    </button>

                  </>





                )}
              </td></tr>

              <tr><td style={labelCellStyle}>Registry</td><td style={cellStyle}>{renderValue(ipInfo.registry)}</td></tr>
              <tr><td style={labelCellStyle}>Timezone</td><td style={cellStyle}>{renderValue(ipInfo.timezone)}</td></tr>
            </tbody>
          </table>


          {ipInfo != null && ipInfo.latitude != null && ipInfo.longitude != null && (
            <iframe
              width="100%"
              height="300"
              frameBorder="0"
              scrolling="no"
              marginHeight={0}
              marginWidth={0}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${ipInfo.longitude},${ipInfo.latitude},${ipInfo.longitude},${ipInfo.latitude}&layer=mapnik&marker=${ipInfo.latitude},${ipInfo.longitude}`}
              style={{ marginTop: '1rem', marginBottom: '1rem' }}
            />
          )}


        </div>
      }
    </div>
  )
}


export function RowDetailPanel({ tabularResult, selectedRow, onClose, isOpen }: RowDetailPanelProps) {
  const [hasShownBefore, setHasShownBefore] = useState(false);

  useEffect(() => {
    if (isOpen && !hasShownBefore) {
      setHasShownBefore(true);
    }
  }, [isOpen, hasShownBefore]);

  const handleClose = () => {
    setTimeout(() => {
      setHasShownBefore(false);
      onClose();
    }, 300);
  };




  if (selectedRow == null) {
    return null;
  }

  return (
    <div className={`detail-panel ${isOpen ? 'open' : ''}`}>
      <div className="detail-panel-content">
        {/* Fixed Header */}
        <div className="detail-panel-header">
          <button className="detail-panel-close-button" onClick={handleClose}>
            <X className="detail-panel-close-icon" />
            <span className="detail-panel-close-text">Close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="detail-panel-body">
          <table className="detail-panel-table">
            <thead>
              <tr>
                <th className="detail-panel-table-head" style={{ width: '33.33%' }}>Field</th>
                <th className="detail-panel-table-head">Details</th>
              </tr>
            </thead>
            <tbody>
              {tabularResult.columns.map((column, index) => (
                <tr key={index} className="detail-panel-table-row">
                  <td className="detail-panel-table-cell" style={{ fontWeight: 500 }}>{column}</td>
                  <td className="detail-panel-table-cell" style={{ wordBreak: 'break-word' }}>
                    {tabularResult.rows[selectedRow][index]}
                    {enrichmentsFor(column, tabularResult.rows[selectedRow][index])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 
